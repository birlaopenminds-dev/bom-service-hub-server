export interface ISendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
  attachments?: any[];
}

