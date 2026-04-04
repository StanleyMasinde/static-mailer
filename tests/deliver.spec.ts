import 'dotenv/config'
import request from 'supertest';
import app from '../src/app';
import { database } from '../src/config/database';
import { faker } from '@faker-js/faker';
import * as mailer from '../src/config/mailer';
import { afterAll, beforeEach, describe, it, vi } from 'vitest';
import { expect } from 'vitest';

const application = app.callback();
const requester = request(application);
const user = {
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.internet.password(),
};

describe('Email delivery test', () => {
  afterAll(async () => {
    await database.destroy();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Deliver an email', async () => {
    const registerUserRequest = await requester
      .post('/v1/register')
      .send(user);

    expect(registerUserRequest.status).toBe(200);
    expect(registerUserRequest.body).toHaveProperty('token');
    expect(registerUserRequest.body.user).toHaveProperty('email');

    const createApiKeyRequest = await requester
      .post('/v1/apiKeys')
      .set('authorization', `Bearer ${registerUserRequest.body.token}`)
      .send({
        name: faker.lorem.words(),
      });

    expect(createApiKeyRequest.status).toBe(200);
    expect(createApiKeyRequest.body).toHaveProperty('apiKey');
    expect(createApiKeyRequest.body).toHaveProperty('rawKey');
    expect(createApiKeyRequest.body.apiKey).toHaveProperty('key_last4');
    expect(createApiKeyRequest.body.apiKey).not.toHaveProperty('key');

    const deliveryResponse = await requester
      .post(`/api/v1/deliver/${createApiKeyRequest.body.rawKey}`)
      .send({
        subject: faker.lorem.sentence(),
        email: faker.internet.email(),
        message: faker.lorem.paragraphs(),
      });

    expect(deliveryResponse.status).toBe(200);

    const keyUuid = createApiKeyRequest.body.apiKey.uuid;
    const submission = await database('email_submissions')
      .where('key_uuid', keyUuid)
      .orderBy('id', 'desc')
      .first();
    expect(submission).toBeTruthy();
    expect(submission.delivery_status).toBe('accepted');
    expect(submission.sender_ip).toBeTruthy();

    const keyRecord = await database('api_keys')
      .where('uuid', keyUuid)
      .first();
    expect(keyRecord.last_used_at).toBeTruthy();
  });

  it('Rejects delivery requests with missing subject', async () => {
    const deliveryResponse = await requester
      .post('/api/v1/deliver/some-key')
      .send({
        email: faker.internet.email(),
        message: faker.lorem.paragraphs(),
      });

    expect(deliveryResponse.status).toBe(422);
  });

  it('Return 404 when key is not found', async () => {
    const deliveryResponse = await requester
      .post('/api/v1/deliver/some-key')
      .send({
        subject: faker.lorem.sentence(),
        email: faker.internet.email(),
        message: faker.lorem.paragraphs(),
      });

    expect(deliveryResponse.status).toBe(404);
    expect(deliveryResponse.body).toHaveProperty('errors');
  });

  it('Records failed delivery status when mail transport fails', async () => {
    const registerUserRequest = await requester
      .post('/v1/register')
      .send({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
      });

    const createApiKeyRequest = await requester
      .post('/v1/apiKeys')
      .set('authorization', `Bearer ${registerUserRequest.body.token}`)
      .send({
        name: faker.lorem.words(),
      });

    vi.spyOn(mailer, 'fowardEmail').mockRejectedValue(new Error('SMTP unavailable'));

    const deliveryResponse = await requester
      .post(`/api/v1/deliver/${createApiKeyRequest.body.rawKey}`)
      .send({
        subject: faker.lorem.sentence(),
        email: faker.internet.email(),
        message: faker.lorem.paragraphs(),
      });

    expect(deliveryResponse.status).toBe(502);
    expect(deliveryResponse.body).toHaveProperty('errors');

    const failedSubmission = await database('email_submissions')
      .where('key_uuid', createApiKeyRequest.body.apiKey.uuid)
      .orderBy('id', 'desc')
      .first();
    expect(failedSubmission.delivery_status).toBe('failed');
  });
});
