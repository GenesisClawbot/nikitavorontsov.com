export async function deliverShare(text, navigatorLike = navigator) {
  if (typeof navigatorLike.share === 'function') {
    await navigatorLike.share({
      title: 'Subscription Autopsy',
      text,
    });
    return 'shared';
  }

  if (typeof navigatorLike.clipboard?.writeText === 'function') {
    await navigatorLike.clipboard.writeText(text);
    return 'copied';
  }

  throw new Error('This browser cannot share or copy the receipt.');
}
