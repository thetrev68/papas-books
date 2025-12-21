import { supabase } from './config';

describe('Supabase Config', () => {
  it('should initialize supabase client', () => {
    expect(supabase).toBeDefined();
    expect(supabase).toBeTruthy();
  });
});
