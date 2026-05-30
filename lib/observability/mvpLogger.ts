export type MvpLogPayload = {
  request_id?: string;
  user_id?: string;
  route?: string;
  event_type?: string;
  operation?: string;
  duration_ms?: number;
  status?: 'success' | 'failure' | 'info' | 'warn';
  error_message?: string;
  [key: string]: any;
};

export const mvpLogger = {
  info: (msg: string, payload?: MvpLogPayload) => {
    console.log(JSON.stringify({ level: 'INFO', msg, timestamp: new Date().toISOString(), ...payload }));
  },
  warn: (msg: string, payload?: MvpLogPayload) => {
    console.warn(JSON.stringify({ level: 'WARN', msg, timestamp: new Date().toISOString(), ...payload }));
  },
  error: (msg: string, payload?: MvpLogPayload) => {
    console.error(JSON.stringify({ level: 'ERROR', msg, timestamp: new Date().toISOString(), ...payload }));
  }
};
