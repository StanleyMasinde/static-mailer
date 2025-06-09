import 'dotenv/config'
import request from 'supertest';
import app from '../src/app';
import { database } from '../src/config/database';
import { faker } from '@faker-js/faker';
import { afterAll, describe, it } from 'vitest';
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
    expect(createApiKeyRequest.body.apiKey).toHaveProperty('key');

    const deliveryResponse = await requester
      .post(`/api/v1/deliver/${createApiKeyRequest.body.apiKey.key}`)
      .send({
        subject: faker.lorem.sentence(),
        email: faker.internet.email(),
        message: faker.lorem.paragraphs(),
      });

    expect(deliveryResponse.status).toBe(200);
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
  });
});
