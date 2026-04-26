export interface AccountInfo {
  id:          string;
  name:        string;
  email:       string;
  balanceReal: number;
  balanceDemo: number;
  currency:    string;
  isConnected: boolean;
  copyRunning?: boolean;
  connectedAt?: string;
}

export interface CopySettings {
  mode:        'fixed' | 'multiplier' | 'proportional';
  amount:      number;
  accountType: 'real' | 'demo';
  isActive:    boolean;
  stopWin:     number | null;
  stopLoss:    number | null;
}

export interface SessionStats {
  wins:        number;
  losses:      number;
  totalTrades: number;
  profit:      number;
  startedAt?:  string;
}

export interface FollowerAccount {
  id:           string;
  name:         string;
  email:        string;
  balanceReal:  number;
  balanceDemo:  number;
  currency:     string;
  isConnected:  boolean;
  copySettings: CopySettings;
  sessionStats: SessionStats;
  connectedAt?: string;
}

export interface TradeRecord {
  id:              string;
  masterId:        string;
  followerId:      string;
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
