require('dotenv').config()
const request = require('supertest')
const app = require('../dist/app')
const { faker } = require('@faker-js/faker')
const { database } = require('../dist/config/database')
const application = request(app.default.callback())

const user = {
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.internet.password()
};

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

  // Uncomment and update the following tests based on your needs
  /*
  test('Handle Google registration', async () => {
    const response = await application
      .post('/v1/social-auth/google')
      .send({
        token: sign({
          sub: faker.random.numeric(),
          email: faker.internet.email(),
          name: faker.name.fullName()
        }, 'secret')
      });

    expect(response.body).toHaveProperty('token');
  });

  test('Handle Google login', async () => {
    const response = await application
      .post('/v1/social-auth/google')
      .send({
        token: sign({
          sub: faker.random.numeric(),
          email: user.email,
          name: user.password
        }, 'secret')
      });

    expect(response.body).toHaveProperty('token');
  });

  test('Get the current user', async () => {
    const response = await application
      .post('/v1/login')
      .send({
        email: user.email,
        password: user.password
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');

    const authPasses = await application
      .get('/v1/me')
      .set('authorization', `Bearer ${response.body.token}`);

    console.log('Response', authPasses.body);
  });
  */
});
