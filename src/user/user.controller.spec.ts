import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { BadRequestException } from '@nestjs/common';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

const mockUserService = {
  listar: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  it('deve listar usuários', async () => {
    const mockUsers = [{ id: '1', nome: 'Admin' }];
    (service.listar as jest.Mock).mockResolvedValue(mockUsers);

    const req = { user: { master: true, id: 'admin-id' } } as any;
    const result = await controller.listar(req);
    expect(result).toEqual(mockUsers);
    expect(service.listar).toHaveBeenCalled();
  });

  it('deve criar um usuário', async () => {
    const mockUser = { id: '1', email: 'test@test.com' };
    (service.criar as jest.Mock).mockResolvedValue(mockUser);

    const req = { user: { master: true, id: 'admin-id' } } as any;
    const result = await controller.criar(
      {
        email: 'test@test.com',
        senha: '123',
        nome: 'Test',
        papel: 'admin',
      },
      req,
    );
    expect(result).toEqual(mockUser);
    expect(service.criar).toHaveBeenCalledWith(
      'test@test.com',
      '123',
      'Test',
      'admin',
      undefined,
      undefined,
      'admin-id',
    );
  });

  it('deve lançar erro se faltar email na criação', () => {
    const req = { user: { master: true, id: 'admin-id' } } as any;
    expect(() =>
      controller.criar(
        {
          email: '',
          senha: '123',
        },
        req,
      ),
    ).toThrow(BadRequestException);
  });

  it('deve atualizar um usuário', async () => {
    const mockUser = { id: '1', nome: 'Test Updated' };
    (service.atualizar as jest.Mock).mockResolvedValue(mockUser);

    const result = await controller.atualizar('1', { nome: 'Test Updated' });
    expect(result).toEqual(mockUser);
    expect(service.atualizar).toHaveBeenCalledWith('1', { nome: 'Test Updated' });
  });

  it('deve excluir um usuário', async () => {
    (service.excluir as jest.Mock).mockResolvedValue({ ok: true });

    const req = { user: { id: 'admin-id' } } as unknown as RequestWithUser;

    const result = await controller.excluir('1', req);
    expect(result).toEqual({ ok: true });
    expect(service.excluir).toHaveBeenCalledWith('1', 'admin-id');
  });
});
