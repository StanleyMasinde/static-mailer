import 'dotenv/config'
import request from 'supertest';
import app from '../dist/app';
import { database } from '../dist/config/database';
import { faker } from '@faker-js/faker';

const application = app.default.callback();
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

  test('Deliver an email', async () => {
    const registerUserRequest = await requester
      .post('/v1/register')
      .send(user);

    expect(registerUserRequest.status).toBe(200);
    expect(registerUserRequest.body).toHaveProperty('token');
    expect(registerUserRequest.body.user).toHaveProperty('id', 'name', 'email');

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

  test('Return 404 when key is not found', async () => {
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
