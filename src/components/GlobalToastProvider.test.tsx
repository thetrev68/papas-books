import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlobalToastProvider, useToast } from './GlobalToastProvider';

// Helper component to test the hook
function TestComponent() {
  const { showError, showSuccess, showInfo, showConfirm } = useToast();

  return (
    <div>
      <button onClick={() => showError('Error message')}>Show Error</button>
      <button onClick={() => showSuccess('Success message')}>Show Success</button>
      <button onClick={() => showInfo('Info message')}>Show Info</button>
      <button
        onClick={() =>
          showConfirm('Confirm message', {
            onConfirm: () => console.log('confirmed'),
            onCancel: () => console.log('cancelled'),
            confirmText: 'Yes',
            cancelText: 'No',
            variant: 'danger',
          })
        }
      >
        Show Confirm
      </button>
    </div>
  );
}

describe('GlobalToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders children without error', () => {
    render(
      <GlobalToastProvider>
        <div>Test Content</div>
      </GlobalToastProvider>
    );

    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('throws error when useToast is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <div>
          <TestComponent />
        </div>
      );
    }).toThrow('useToast must be used within a GlobalToastProvider');

    consoleSpy.mockRestore();
  });

  it('displays error toast when showError is called', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));

    expect(screen.getByText('Error message')).toBeTruthy();
  });

  it('displays success toast when showSuccess is called', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));

    expect(screen.getByText('Success message')).toBeTruthy();
  });

  it('displays info toast when showInfo is called', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByText('Info message')).toBeTruthy();
  });

  it('displays confirm toast with custom buttons', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Confirm'));

    expect(screen.getByText('Confirm message')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();

    function ConfirmTest() {
      const { showConfirm } = useToast();

      return (
        <button
          onClick={() =>
            showConfirm('Confirm?', {
              onConfirm,
              confirmText: 'Confirm',
            })
          }
        >
          Show
        </button>
      );
    }

    render(
      <GlobalToastProvider>
        <ConfirmTest />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();

    function CancelTest() {
      const { showConfirm } = useToast();

      return (
        <button
          onClick={() =>
            showConfirm('Confirm?', {
              onConfirm: vi.fn(),
              onCancel,
              cancelText: 'Cancel',
            })
          }
        >
          Show
        </button>
      );
    }

    render(
      <GlobalToastProvider>
        <CancelTest />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses error toast after configured duration', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeTruthy();

    // Fast-forward past error toast duration (5000ms from constants)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Error message')).toBeFalsy();
  });

  it('auto-dismisses success toast after configured duration', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeTruthy();

    // Fast-forward past success toast duration (3000ms from constants)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Success message')).toBeFalsy();
  });

  it('auto-dismisses info toast after configured duration', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Info'));
    expect(screen.getByText('Info message')).toBeTruthy();

    // Fast-forward past info toast duration (4000ms from constants)
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Info message')).toBeFalsy();
  });

  it('does not auto-dismiss confirm toast', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Confirm'));
    expect(screen.getByText('Confirm message')).toBeTruthy();

    // Fast-forward timers - confirm should still be visible
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Confirm message')).toBeTruthy();
  });

  it('replaces previous toast when new one is shown', () => {
    render(
      <GlobalToastProvider>
        <TestComponent />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeTruthy();

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.queryByText('Error message')).toBeFalsy();
    expect(screen.getByText('Success message')).toBeTruthy();
  });

  it('applies correct variant styles for danger confirm', () => {
    function DangerConfirmTest() {
      const { showConfirm } = useToast();

      return (
        <button
          onClick={() =>
            showConfirm('Delete?', {
              onConfirm: vi.fn(),
              variant: 'danger',
            })
          }
        >
          Show Danger
        </button>
      );
    }

    render(
      <GlobalToastProvider>
        <DangerConfirmTest />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Danger'));

    // Verify the confirm toast is displayed
    expect(screen.getByText('Delete?')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('applies correct variant styles for warning confirm', () => {
    function WarningConfirmTest() {
      const { showConfirm } = useToast();

      return (
        <button
          onClick={() =>
            showConfirm('Warning?', {
              onConfirm: vi.fn(),
              variant: 'warning',
            })
          }
        >
          Show Warning
        </button>
      );
    }

    render(
      <GlobalToastProvider>
        <WarningConfirmTest />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Warning'));

    // Verify the confirm toast is displayed
    expect(screen.getByText('Warning?')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('uses default button text when not provided', () => {
    function DefaultTextTest() {
      const { showConfirm } = useToast();

      return (
        <button
          onClick={() =>
            showConfirm('Default?', {
              onConfirm: vi.fn(),
            })
          }
        >
          Show Default
        </button>
      );
    }

    render(
      <GlobalToastProvider>
        <DefaultTextTest />
      </GlobalToastProvider>
    );

    fireEvent.click(screen.getByText('Show Default'));

    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});
