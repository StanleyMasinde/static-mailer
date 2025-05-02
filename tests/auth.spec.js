import 'dotenv/config'
import request from 'supertest'
import app from '../dist/app'
import { faker } from '@faker-js/faker'
import { database } from '../dist/config/database'
const application = request(app.callback())

const user = {
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.internet.password()
};

let token = ''
let userId = null
let keyUiid = faker.string.uuid()

describe('Authentication tests', () => {
  afterAll(async () => {
    await database.destroy();
  });

  test('Throw a 400 when the request body is missing', async () => {
    const response = await application.post('/v1/register');
    expect(response.status).toBe(400);
  });

  test('User registration succeeds with valid data', async () => {
    const response = await application
      .post('/v1/register')
      .send(user);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toHaveProperty('id', 'name', 'email');
  });

  test('User registration fails when email exists', async () => {
    const response = await application
      .post('/v1/register')
      .send(user);

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0].message).toBe('This email is already registered');
  });

  test('User registration fails without request body', async () => {
    const response = await application.post('/v1/register');
    expect(response.status).toBe(400);
  });

  test('User registration fails with invalid data', async () => {
    const response = await application
      .post('/v1/register')
      .send({
        email: 'foo'
      });

    expect(response.status).toBe(422);
  });

  test('User can login with valid credentials', async () => {
    const response = await application
      .post('/v1/login')
      .send({
        email: user.email,
        password: user.password
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    token = response.body.token
  });

  test('User login fails without request body', async () => {
    const response = await application.post('/v1/login');
    expect(response.status).toBe(400);
  });

  test('User login fails with incorrect credentials', async () => {
    const response = await application
      .post('/v1/login')
      .send({
        email: 'foo@bar.com',
        password: 'wrong password'
      });

    expect(response.status).toBe(401);
  });

  test('Get the current user', async () => {
    const response = await application
      .get('/v1/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.body).toHaveProperty('user')
    userId = response.body.user.id
  })

  test('Get user API KEYS', async () => {
    await database('api_keys')
      .insert({
        uuid: keyUiid,
        key: faker.string.alphanumeric(16),
        user_id: userId
      })
    const response = await application
      .get('/v1/apiKeys')
      .set('Authorization', `Bearer ${token}`)

    expect(response.body.data.length).toBe(1)
  })

  test('Delete an API KEY', async () => {
    const response = await application
      .delete(`/v1/apiKeys/${keyUiid}`)
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data).toBe('Key deleted.')
  })
});
