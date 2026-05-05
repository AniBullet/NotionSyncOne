import * as fs from 'fs';
import * as path from 'path';
import { SyncState, SyncStatus } from '../../../shared/types/sync';

type SyncStateMap = { [key: string]: SyncState };

export class SyncStateStore {
  private syncStates: SyncStateMap = {};

  constructor(private readonly syncStateFile: string) {
    this.load();
  }

  get(articleId: string): SyncState | undefined {
    return this.syncStates[articleId];
  }

  getAll(): SyncStateMap {
    return this.syncStates;
  }

  update(articleId: string, status: SyncStatus, error?: string, results?: SyncState['results']): SyncState {
    const existingState = this.syncStates[articleId];
    const state: SyncState = {
      articleId,
      status,
      lastSyncTime: Date.now(),
      error,
      results: results ? { ...existingState?.results, ...results } : existingState?.results,
    };

    this.syncStates[articleId] = state;
    this.save();
    return state;
  }

  reset(articleId: string): void {
    delete this.syncStates[articleId];
    this.save();
  }

  resetStuck(stuckTimeoutMs: number, now: number = Date.now()): string[] {
    const resetArticleIds: string[] = [];

    for (const [articleId, state] of Object.entries(this.syncStates)) {
      if (state.status === SyncStatus.SYNCING && state.lastSyncTime && now - state.lastSyncTime > stuckTimeoutMs) {
        this.update(articleId, SyncStatus.FAILED, '同步超时：操作时间过长，已自动重置');
        resetArticleIds.push(articleId);
      }
    }

    return resetArticleIds;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.syncStateFile)) {
        const data = fs.readFileSync(this.syncStateFile, 'utf8');
        this.syncStates = JSON.parse(data);
        this.resetInterruptedSyncs();
      }
    } catch (error) {
      console.error('加载同步状态失败:', error);
      this.syncStates = {};
    }
  }

  private resetInterruptedSyncs(): void {
    let resetCount = 0;

    for (const [articleId, state] of Object.entries(this.syncStates)) {
      if (state.status === SyncStatus.SYNCING) {
        this.syncStates[articleId] = {
          ...state,
          status: SyncStatus.FAILED,
          error: '同步中断：程序重启',
          lastSyncTime: Date.now(),
        };
        resetCount++;
      }
    }

    if (resetCount > 0) {
      this.save();
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.syncStateFile), { recursive: true });
      fs.writeFileSync(this.syncStateFile, JSON.stringify(this.syncStates, null, 2));
      if (process.env.NODE_ENV === 'development') {
        console.log('同步状态已保存');
      }
    } catch (error) {
      console.error('保存同步状态失败:', error);
    }
  }
}
