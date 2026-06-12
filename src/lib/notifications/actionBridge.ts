type MarkDoneFn = (notificationId: string) => Promise<{ success: boolean; error?: string }>;

let markDoneFn: MarkDoneFn | null = null;

export function initMarkDoneBridge(fn: MarkDoneFn): void {
  markDoneFn = fn;
}

export async function bridgeMarkDone(notificationId: string) {
  if (markDoneFn) await markDoneFn(notificationId);
}