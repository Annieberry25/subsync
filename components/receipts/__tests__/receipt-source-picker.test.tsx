import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceiptSourcePicker from '@/components/receipts/receipt-source-picker';

const mocks = vi.hoisted(() => ({
  captureReceiptPhoto: vi.fn(),
}));

/*
 * The frame grab needs a real camera and a real canvas, neither of which jsdom
 * has. The rest of the flow — the overlay, the shutter, the file that comes
 * out — is what this suite is about.
 */
vi.mock('@/lib/utils/receipt-camera', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/receipt-camera')>();
  return { ...actual, captureReceiptPhoto: mocks.captureReceiptPhoto };
});

const makeImage = (name = 'receipt.jpg', size = 1024) => {
  const file = new File(['x'.repeat(1)], name, { type: 'image/jpeg' });
  // The size is what the picker measures, so it is faked rather than filled.
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

function stubCamera() {
  const stream = {
    getVideoTracks: () => [{ stop: vi.fn() }],
    getTracks: () => [{ stop: vi.fn() }],
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn(async () => stream),
      enumerateDevices: vi.fn(async () => [
        { kind: 'videoinput', deviceId: 'back' },
        { kind: 'videoinput', deviceId: 'front' },
      ]),
    },
    configurable: true,
  });

  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
}

function renderPicker(over: Partial<React.ComponentProps<typeof ReceiptSourcePicker>> = {}) {
  const onFileChange = vi.fn();
  const onError = vi.fn();
  render(
    <ReceiptSourcePicker
      file={null}
      onFileChange={onFileChange}
      onError={onError}
      {...over}
    />
  );
  return { onFileChange, onError };
}

describe('ReceiptSourcePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.captureReceiptPhoto.mockResolvedValue(
      new File(['jpeg'], 'receipt-snap.jpg', { type: 'image/jpeg' })
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    Reflect.deleteProperty(window, 'isSecureContext');
  });

  it('brings out the camera, the gallery and a file when the upload area is tapped', () => {
    renderPicker();

    // The sources stay out of the way until the upload area asks for them.
    expect(screen.queryByRole('button', { name: /Scan with camera/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Show receipt source options/i }));

    expect(screen.getByRole('button', { name: /Scan with camera/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose from gallery/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import file/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Upload receipt file/i)).toBeInTheDocument();
  });

  it('hands a picked gallery photo to the host', () => {
    const { onFileChange, onError } = renderPicker();
    const file = makeImage('bill.jpg');

    fireEvent.change(screen.getByLabelText(/Choose a receipt from your gallery/i), {
      target: { files: [file] },
    });

    expect(onFileChange).toHaveBeenCalledWith(file);
    expect(onError).toHaveBeenCalledWith(null);
  });

  it('refuses a photo larger than the image limit', () => {
    const { onFileChange, onError } = renderPicker();
    const tooBig = makeImage('huge.jpg', 9 * 1024 * 1024);

    fireEvent.change(screen.getByLabelText(/Choose a receipt from your gallery/i), {
      target: { files: [tooBig] },
    });

    expect(onFileChange).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/8MB/i));
    expect(screen.getByText(/8MB limit/i)).toBeInTheDocument();
  });

  it('opens the camera and hands the snapped photo to the host', async () => {
    stubCamera();
    const user = userEvent.setup();
    const { onFileChange } = renderPicker();

    await user.click(screen.getByRole('button', { name: /Show receipt source options/i }));
    await user.click(screen.getByRole('button', { name: /Scan with camera/i }));

    const dialog = await screen.findByRole('dialog', { name: /Scan receipt/i });
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Take photo/i }));

    await waitFor(() => {
      expect(onFileChange).toHaveBeenCalledTimes(1);
    });
    expect(onFileChange.mock.calls[0][0].type).toBe('image/jpeg');
  });

  it('falls back to the device camera when the browser has no camera API', async () => {
    const user = userEvent.setup();
    renderPicker();

    // Without a camera API the picker hands over to the device's own camera
    // rather than opening a view that could never work.
    expect(screen.queryByRole('dialog', { name: /Scan receipt/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Show receipt source options/i }));
    await user.click(screen.getByRole('button', { name: /Scan with camera/i }));
    expect(screen.queryByRole('dialog', { name: /Scan receipt/i })).toBeNull();
    expect(screen.getByLabelText(/Take a receipt photo/i)).toBeInTheDocument();
  });
});
