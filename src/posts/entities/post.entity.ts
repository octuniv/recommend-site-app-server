import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  AfterLoad,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Board } from '@/boards/entities/board.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  videoUrl?: string; // 비디오 링크 (선택사항)

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  commentsCount: number;

  @ManyToOne(() => User, (user) => user.posts, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  createdBy!: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  nickname?: string;

  @ManyToOne(() => Board, (board) => board.posts, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  board: Board;

  @Column({ type: 'float', default: 0 })
  hotScore: number;

  @AfterLoad()
  setNickname() {
    this.nickname = this.createdBy?.nickname || null;
  }
}
