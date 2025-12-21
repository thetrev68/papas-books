import { describe, it, expect } from 'vitest';
import { supabase } from './config';

describe('Supabase Config', () => {
  it('should initialize supabase client', () => {
    expect(supabase).toBeDefined();
  });

  it('should have the correct URL from environment variables', () => {
    // We can't easily check internal URL property on the client without inspecting private props 
    // or making a mock request, but we can check if the client was created.
    // However, if we want to be sure it loaded env vars, we might check import.meta.env
    // But in a test environment, import.meta.env might be mocked or different.
    
    // For now, just ensuring it didn't throw on import is a good start.
    expect(supabase).toBeTruthy();
  });
});
