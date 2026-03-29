import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { FileSystemService } from '../fs'

let tmpDir: string
let service: FileSystemService

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-service-test-'))
  service = new FileSystemService(tmpDir)
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('FileSystemService', () => {
  describe('read', () => {
    it('returns correct content for an existing file', async () => {
      const filePath = path.join(tmpDir, 'hello.txt')
      await fs.writeFile(filePath, 'hello world', 'utf-8')
      const result = await service.read(filePath)
      expect(result.content).toBe('hello world')
    })

    it('throws PATH_TRAVERSAL when path escapes baseDir', async () => {
      const outsidePath = path.join(os.tmpdir(), 'outside.txt')
      await expect(service.read(outsidePath)).rejects.toThrow('PATH_TRAVERSAL')
    })
  })

  describe('write', () => {
    it('creates parent directories and writes content', async () => {
      const filePath = path.join(tmpDir, 'a', 'b', 'c', 'file.txt')
      await service.write(filePath, 'test content')
      const written = await fs.readFile(filePath, 'utf-8')
      expect(written).toBe('test content')
    })

    it('throws PATH_TRAVERSAL when path escapes baseDir', async () => {
      const outsidePath = path.join(os.tmpdir(), 'evil.txt')
      await expect(service.write(outsidePath, 'evil')).rejects.toThrow('PATH_TRAVERSAL')
    })
  })

  describe('list', () => {
    it('returns correct entries for a directory', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), '')
      await fs.writeFile(path.join(tmpDir, 'file2.txt'), '')
      await fs.mkdir(path.join(tmpDir, 'subdir'))

      const entries = await service.list(tmpDir)
      const names = entries.map((e) => e.name).sort()
      expect(names).toContain('file1.txt')
      expect(names).toContain('file2.txt')
      expect(names).toContain('subdir')

      const subdir = entries.find((e) => e.name === 'subdir')
      expect(subdir?.isDirectory).toBe(true)

      const file = entries.find((e) => e.name === 'file1.txt')
      expect(file?.isDirectory).toBe(false)
      expect(file?.path).toBe(path.join(tmpDir, 'file1.txt'))
    })

    it('throws PATH_TRAVERSAL when path escapes baseDir', async () => {
      await expect(service.list(os.tmpdir())).rejects.toThrow('PATH_TRAVERSAL')
    })
  })

  describe('assertSafe', () => {
    it('rejects ../ traversal attempts', async () => {
      const traversalPath = path.join(tmpDir, '..', 'other')
      await expect(service.read(traversalPath)).rejects.toThrow('PATH_TRAVERSAL')
    })

    it('rejects paths with ../ in the middle', async () => {
      const traversalPath = path.join(tmpDir, 'subdir', '..', '..', 'etc', 'passwd')
      await expect(service.read(traversalPath)).rejects.toThrow('PATH_TRAVERSAL')
    })

    it('allows paths within baseDir', async () => {
      const filePath = path.join(tmpDir, 'safe.txt')
      await fs.writeFile(filePath, 'safe')
      await expect(service.read(filePath)).resolves.toEqual({ content: 'safe' })
    })
  })
})
