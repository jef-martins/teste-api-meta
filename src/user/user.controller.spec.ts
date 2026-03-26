import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

const mockUserService = {
  listar: jest.fn(),
  listarPorAdmin: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
};

const buildReq = (user: Partial<RequestWithUser['user']>): RequestWithUser =>
  ({
    user: {
      id: 'default-user',
      papel: 'user',
      master: false,
      ...user,
    },
  }) as RequestWithUser;

describe('UserController', () => {
  let controller: UserController;

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
    jest.clearAllMocks();
  });

  it('lista usuários para master', async () => {
    const mockUsers = [{ id: '1', nome: 'Admin' }];
    mockUserService.listar.mockResolvedValue(mockUsers);

    const result = await controller.listar(
      buildReq({ id: 'master-id', master: true }),
    );

    expect(result).toEqual(mockUsers);
    expect(mockUserService.listar).toHaveBeenCalledTimes(1);
  });

  it('lista usuários para admin usando listarPorAdmin', async () => {
    const mockUsers = [{ id: '2', nome: 'Colaborador' }];
    mockUserService.listarPorAdmin.mockResolvedValue(mockUsers);

    const result = await controller.listar(
      buildReq({ id: 'admin-id', papel: 'admin', master: false }),
    );

    expect(result).toEqual(mockUsers);
    expect(mockUserService.listarPorAdmin).toHaveBeenCalledWith('admin-id');
  });

  it('bloqueia listagem para usuário sem permissão', () => {
    expect(() =>
      controller.listar(buildReq({ papel: 'user', master: false })),
    ).toThrow(ForbiddenException);
  });

  it('cria usuário admin quando master informa organização', async () => {
    const mockUser = { id: '1', email: 'test@test.com' };
    mockUserService.criar.mockResolvedValue(mockUser);

    const result = await controller.criar(
      {
        email: 'test@test.com',
        senha: '123',
        nome: 'Test',
        papel: 'admin',
        organizacaoId: 'org-1',
      },
      buildReq({ id: 'master-id', master: true }),
    );

    expect(result).toEqual(mockUser);
    expect(mockUserService.criar).toHaveBeenCalledWith(
      'test@test.com',
      '123',
      'Test',
      'admin',
      'org-1',
      undefined,
      'master-id',
    );
  });

  it('exige organização ao master criar admin', () => {
    expect(() =>
      controller.criar(
        {
          email: 'test@test.com',
          senha: '123',
          nome: 'Test',
          papel: 'admin',
        },
        buildReq({ id: 'master-id', master: true }),
      ),
    ).toThrow(BadRequestException);
  });

  it('exige sub-organização ao admin criar usuário comum', () => {
    expect(() =>
      controller.criar(
        {
          email: 'novo@test.com',
          senha: '123',
          nome: 'Novo',
        },
        buildReq({ id: 'admin-id', papel: 'admin', master: false }),
      ),
    ).toThrow(BadRequestException);
  });

  it('força papel user quando admin cria usuário', async () => {
    mockUserService.criar.mockResolvedValue({ id: '3' });

    await controller.criar(
      {
        email: 'novo@test.com',
        senha: '123',
        nome: 'Novo',
        papel: 'admin',
        subOrganizacaoId: 'sub-1',
      },
      buildReq({ id: 'admin-id', papel: 'admin', master: false }),
    );

    expect(mockUserService.criar).toHaveBeenCalledWith(
      'novo@test.com',
      '123',
      'Novo',
      'user',
      undefined,
      'sub-1',
      'admin-id',
    );
  });

  it('valida email e senha obrigatórios na criação', () => {
    expect(() =>
      controller.criar(
        {
          email: '',
          senha: '123',
        },
        buildReq({ id: 'master-id', master: true }),
      ),
    ).toThrow(BadRequestException);
  });

  it('atualiza um usuário', async () => {
    const mockUser = { id: '1', nome: 'Test Updated' };
    mockUserService.atualizar.mockResolvedValue(mockUser);

    const result = await controller.atualizar('1', { nome: 'Test Updated' });

    expect(result).toEqual(mockUser);
    expect(mockUserService.atualizar).toHaveBeenCalledWith('1', {
      nome: 'Test Updated',
    });
  });

  it('exclui um usuário', async () => {
    mockUserService.excluir.mockResolvedValue({ ok: true });

    const result = await controller.excluir('1', buildReq({ id: 'admin-id' }));

    expect(result).toEqual({ ok: true });
    expect(mockUserService.excluir).toHaveBeenCalledWith('1', 'admin-id');
  });
});
