require('dotenv').config();
const request = require('supertest');
const app = require('../dist/app');
const { database } = require('../dist/config/database');
const { faker } = require('@faker-js/faker');

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
});
