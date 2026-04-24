import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('Auth (e2e)', () => {
    const testUser = {
      email: `test-${Date.now()}@test.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'EMPLOYEE',
    };

    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .then((res) => {
          expect(res.body.email).toBe(testUser.email);
        });
    });

    it('should login and return a token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201)
        .then((res) => {
          expect(res.body.access_token).toBeDefined();
        });
    });

    it('should fail to login with wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong_password',
        })
        .expect(401);
    });

    it('should fail to register an existing user (Duplicate Email)', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(401)
        .then((res) => {
          expect(res.body.message).toBe('Email already exists');
        });
    });
  });
});
