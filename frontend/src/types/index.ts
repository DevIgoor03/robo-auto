export type CopyMode = 'fixed' | 'multiplier' | 'proportional';
export type AccountType = 'real' | 'demo';
export type TradeResult = 'win' | 'loss' | 'pending';
export type TradeDirection = 'call' | 'put';

export interface AccountInfo {
  id: string;
  name: string;
  email: string;
  balanceReal: number;
  balanceDemo: number;
  currency: string;
  isConnected: boolean;
  connectedAt?: string;
}

export interface CopySettings {
  mode: CopyMode;
  amount: number;
  accountType: AccountType;
  isActive: boolean;
  stopWin: number | null;
  stopLoss: number | null;
}

export interface SessionStats {
  wins: number;
  losses: number;
  totalTrades: number;
  profit: number;
  startedAt: string;
}

export interface FollowerAccount {
  id: string;
  name: string;
  email: string;
  balanceReal: number;
  balanceDemo: number;
  currency: string;
  isConnected: boolean;
  copySettings: CopySettings;
  sessionStats: SessionStats;
  connectedAt?: string;
}

export interface TradeRecord {
  id:              string;
  masterId:        string;
  followerId:      string | null;
  followerName:    string | null;
  masterPositionId: string;
  positionId:      string;
  direction:       string;
  amount:          number;
  instrumentName:  string;
  status:          'OPEN' | 'WIN' | 'LOSS';
  profit:          number;
  openedAt:        string;
  closedAt?:       string;
}

export interface SystemStatus {
  isRunning: boolean;
  masterConnected: boolean;
  followersCount: number;
  activeFollowers: number;
}

export interface InitPayload {
  master: AccountInfo | null;
  followers: FollowerAccount[];
  copyRunning: boolean;
  trades: TradeRecord[];
}
