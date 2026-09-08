'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Modal, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

type Props = {
  endpoint: string;
  // 省略時は削除後にページ遷移せず router.refresh() のみ（一覧内の行削除向け）。
  redirectTo?: string;
  label?: string;
};

export function DeleteButton({ endpoint, redirectTo, label = '削除' }: Props) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (res.ok) {
      close();
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <>
      <Button color="red" size="compact-sm" onClick={open}>
        {label}
      </Button>
      <Modal opened={opened} onClose={close} title="削除確認" centered>
        <Text mb="lg">本当に削除しますか？</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>キャンセル</Button>
          <Button color="red" loading={loading} onClick={handleDelete}>削除</Button>
        </Group>
      </Modal>
    </>
  );
}
