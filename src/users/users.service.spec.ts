import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
  MakeUserEntityFaker,
} from './faker/user.faker';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository, // Mock TypeORM repository
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks(); // Reset all mocks after each test
  });

  describe('signUpUser', () => {
    const createUserDto = MakeCreateUserDtoFaker();
    const { name, email, nickName, password } = createUserDto;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = {
      name: name,
      nickName: nickName,
      email: email,
      passwordHash: hashedPassword,
    };

    it('should create a new user successfully', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(false);
      jest.spyOn(service, 'findAbsenseOfNickName').mockResolvedValue(false);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      jest.spyOn(repository, 'create').mockReturnValue(user as User);
      jest.spyOn(repository, 'save').mockResolvedValue(user as User);

      const result = await service.signUpUser(createUserDto);

      expect(result).toEqual(user);
      expect(repository.create).toHaveBeenCalledWith(user);
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should throw an error if email already exists', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(true);

      await expect(service.signUpUser(createUserDto)).rejects.toThrow(
        new BadRequestException(`This email ${email} is already existed!`),
      );
    });

    it('should throw an error if nickName already exists', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(false);
      jest.spyOn(service, 'findAbsenseOfNickName').mockResolvedValue(true);

      await expect(service.signUpUser(createUserDto)).rejects.toThrow(
        new BadRequestException(
          `This nickName ${nickName} is already existed!`,
        ),
      );
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user if found', async () => {
      const mockUser = MakeUserEntityFaker();
      const email = mockUser.email;

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.findUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email } });
    });

    it('should return null if no user is found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.findUserByEmail('nonexistent@example.com'),
      ).rejects.toThrow(
        new NotFoundException(
          'This email nonexistent@example.com user could not be found',
        ),
      );
    });
  });

  describe('findExistUser', () => {
    it('should return true if user exists', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockResolvedValue({ email: 'test@example.com' } as User);

      const result = await service.findExistUser('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockRejectedValue(new NotFoundException());

      const result = await service.findExistUser('nonexistent@example.com');

      expect(result).toBe(false);
    });

    it('should throw error if an unexpected error occurs', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.findExistUser('error@example.com')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      const updateUserDto = MakeUpdateUserDtoFaker();
      const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
      const user = MakeUserEntityFaker();
      const email = user.email;

      jest.spyOn(service, 'findUserByEmail').mockResolvedValue(user);
      jest
        .spyOn(repository, 'save')
        .mockResolvedValue({ ...user, passwordHash: hashedPassword });

      const result = await service.updatePassword(email, updateUserDto);
      expect(result.passwordHash).toBe(hashedPassword);
      expect(repository.save).toHaveBeenCalledWith({
        ...user,
        passwordHash: hashedPassword,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockRejectedValue(new NotFoundException());

      await expect(
        service.updatePassword('nonexistent@example.com', {
          password: 'newPassword',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAccount', () => {
    it('should remove user account successfully', async () => {
      const mockUser = MakeUserEntityFaker();
      const email = mockUser.email;

      jest.spyOn(service, 'findUserByEmail').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'remove').mockResolvedValue(mockUser);

      const result = await service.removeAccount(email);

      expect(result).toEqual(mockUser);
      expect(service.findUserByEmail).toHaveBeenCalledWith(email);
      expect(repository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockRejectedValue(new NotFoundException());

      await expect(
        service.removeAccount('nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
