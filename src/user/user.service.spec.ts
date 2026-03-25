import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

const mockPrismaService = {
  botUsuario: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('deve listar usuários', async () => {
    const mockUsers = [{ id: '1', nome: 'Admin' }];
    (prisma.botUsuario.findMany as jest.Mock).mockResolvedValue(mockUsers);

    const result = await service.listar();
    expect(result).toEqual(mockUsers);
    expect(prisma.botUsuario.findMany).toHaveBeenCalled();
  });

  it('deve criar um usuário', async () => {
    const mockUser = { id: '1', email: 'test@test.com', nome: 'Test' };
    (prisma.botUsuario.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.criar('test@test.com', '123456', 'Test', 'admin');
    expect(result).toEqual(mockUser);
    expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
    expect(prisma.botUsuario.create).toHaveBeenCalledWith({
      data: {
        email: 'test@test.com',
        senhaHash: 'hashed_password',
        nome: 'Test',
        papel: 'admin',
      },
      select: expect.any(Object),
    });
  });

  it('deve lançar BadRequestException se o email já existir na criação', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Erro', {
      code: 'P2002',
      clientVersion: 'x',
    });
    (prisma.botUsuario.create as jest.Mock).mockRejectedValue(error);

    await expect(
      service.criar('test@test.com', '123456', 'Test', 'admin')
    ).rejects.toThrow(BadRequestException);
  });

  it('deve atualizar um usuário', async () => {
    const mockUser = { id: '1', nome: 'Test Updated' };
    (prisma.botUsuario.update as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.atualizar('1', { nome: 'Test Updated' });
    expect(result).toEqual(mockUser);
    expect(prisma.botUsuario.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: {
        nome: 'Test Updated',
        email: undefined,
        papel: undefined,
        ativo: undefined,
      },
      select: expect.any(Object),
    });
  });

  it('deve excluir um usuário', async () => {
    (prisma.botUsuario.delete as jest.Mock).mockResolvedValue({ id: '2' });

    const result = await service.excluir('2', '1');
    expect(result).toEqual({ ok: true });
    expect(prisma.botUsuario.delete).toHaveBeenCalledWith({
      where: { id: '2' },
    });
  });

  it('deve lançar erro ao excluir a própria conta', async () => {
    await expect(service.excluir('1', '1')).rejects.toThrow(
      BadRequestException
    );
  });
});
