import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineStack,
  Page,
  Select,
  Spinner,
  Text,
  TextField,
} from '@shopify/polaris';
import { useAppBridge } from '@shopify/app-bridge-react';
import { fetchSettings, saveSettings } from './api';
import type {
  CollectionOption,
  GsapQuality,
  SettingsResponse,
  ThemeSettings,
  WhyUsCard,
} from './types';

const DEFAULT_SETTINGS: ThemeSettings = {
  gsap: {
    enabled: true,
    quality: 'balanced',
    enableDesktop: true,
    enableMobile: true,
  },
  homepage: {
    featuredCollectionHandle: '',
    productsLimit: 6,
  },
  whyUs: {
    eyebrow: 'Why Kor',
    title: 'Less noise. More criteria.',
    subtitle:
      'Kor creates products with clean aesthetics, premium materials, and an experience built for people who value detail.',
    cards: [
      {
        title: 'Design with intent',
        text: 'Every piece exists for a reason: form, function, and detail in balance.',
      },
      {
        title: 'Premium materials',
        text: 'Finishes and textures you can feel from the first touch.',
      },
      {
        title: 'Precise details',
        text: 'Nothing extra. Nothing distracting. Every element is crafted to last.',
      },
      {
        title: 'Kor experience',
        text: 'Shopping, presentation, and use with a premium feel from start to finish.',
      },
    ],
  },
};

function normalizeCards(cards: WhyUsCard[]): WhyUsCard[] {
  const source = Array.isArray(cards) ? cards : [];
  const normalized = Array.from({ length: 4 }, (_, index) => {
    const card = source[index] ?? { title: '', text: '' };
    return {
      title: card.title ?? '',
      text: card.text ?? '',
    };
  });

  return normalized;
}

function normalizeSettings(payload?: ThemeSettings): ThemeSettings {
  if (!payload) return DEFAULT_SETTINGS;

  const quality = payload.gsap?.quality;
  const safeQuality: GsapQuality =
    quality === 'high' || quality === 'low' || quality === 'balanced'
      ? quality
      : 'balanced';

  return {
    gsap: {
      enabled: payload.gsap?.enabled ?? true,
      quality: safeQuality,
      enableDesktop: payload.gsap?.enableDesktop ?? true,
      enableMobile: payload.gsap?.enableMobile ?? true,
    },
    homepage: {
      featuredCollectionHandle: payload.homepage?.featuredCollectionHandle ?? '',
      productsLimit: Math.min(Math.max(payload.homepage?.productsLimit ?? 6, 1), 6),
    },
    whyUs: {
      eyebrow: payload.whyUs?.eyebrow ?? DEFAULT_SETTINGS.whyUs.eyebrow,
      title: payload.whyUs?.title ?? DEFAULT_SETTINGS.whyUs.title,
      subtitle: payload.whyUs?.subtitle ?? DEFAULT_SETTINGS.whyUs.subtitle,
      cards: normalizeCards(payload.whyUs?.cards ?? DEFAULT_SETTINGS.whyUs.cards),
    },
  };
}

function getCollectionOptions(collections: CollectionOption[]) {
  const options = collections.map((collection) => ({
    label: `${collection.title} (${collection.handle})`,
    value: collection.handle,
  }));

  return [{ label: 'Use current section setting', value: '' }, ...options];
}

export default function App() {
  const appBridge = useAppBridge();
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState('');

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [initialSettings, settings]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response: SettingsResponse = await fetchSettings();
        const normalized = normalizeSettings(response.settings);

        setShop(response.shop);
        setCollections(response.collections ?? []);
        setSettings(normalized);
        setInitialSettings(normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load settings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const notify = (message: string, isError = false) => {
    const bridgeAny = appBridge as unknown as {
      toast?: {
        show: (content: string, options?: { isError?: boolean; duration?: number }) => void;
      };
    };

    if (bridgeAny?.toast?.show) {
      bridgeAny.toast.show(message, { isError, duration: 3000 });
      return;
    }

    if (isError) console.error(message);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      await saveSettings(settings);
      setInitialSettings(settings);
      notify('Theme control settings saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setError(message);
      notify(message, true);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSettings(initialSettings);
  };

  const updateCard = (index: number, key: keyof WhyUsCard, value: string) => {
    setSettings((prev) => {
      const nextCards = [...prev.whyUs.cards];
      const current = nextCards[index] ?? { title: '', text: '' };
      nextCards[index] = { ...current, [key]: value };

      return {
        ...prev,
        whyUs: {
          ...prev.whyUs,
          cards: nextCards,
        },
      };
    });
  };

  const pickCollection = async () => {
    try {
      const bridgeAny = appBridge as unknown as {
        resourcePicker?: (config: {
          type: 'collection';
          action: 'select';
          multiple: boolean;
        }) => Promise<Array<{ handle?: string }>>;
      };

      if (!bridgeAny.resourcePicker) {
        notify('Resource Picker is not available in this context', true);
        return;
      }

      const selection = await bridgeAny.resourcePicker({
        type: 'collection',
        action: 'select',
        multiple: false,
      });

      const selected = selection?.[0];
      if (!selected?.handle) return;

      setSettings((prev) => ({
        ...prev,
        homepage: {
          ...prev.homepage,
          featuredCollectionHandle: selected.handle ?? '',
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open collection picker';
      notify(message, true);
    }
  };

  if (loading) {
    return (
      <Box padding="800">
        <InlineStack align="center" blockAlign="center">
          <Spinner accessibilityLabel="Loading settings" size="large" />
        </InlineStack>
      </Box>
    );
  }

  return (
    <Page
      title="Kor Theme Control Center"
      subtitle={shop ? `Connected shop: ${shop}` : undefined}
      primaryAction={{
        content: saving ? 'Saving...' : 'Save changes',
        onAction: handleSave,
        disabled: saving || !dirty,
      }}
      secondaryActions={[
        {
          content: 'Discard changes',
          onAction: handleDiscard,
          disabled: saving || !dirty,
        },
      ]}
    >
      <BlockStack gap="400">
        {error ? (
          <Banner title="Action required" tone="critical">
            <p>{error}</p>
          </Banner>
        ) : null}

        {dirty ? (
          <Banner title="Unsaved changes" tone="warning">
            <p>Save to apply updates to your storefront theme.</p>
          </Banner>
        ) : null}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Homepage Featured Collection
              </Text>
              <Button onClick={pickCollection}>Pick collection (App Bridge)</Button>
            </InlineStack>

            <FormSection>
              <Select
                label="Override featured collection (home only)"
                options={getCollectionOptions(collections)}
                value={settings.homepage.featuredCollectionHandle}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    homepage: { ...prev.homepage, featuredCollectionHandle: value },
                  }))
                }
              />

              <TextField
                label="Products limit (1-6)"
                type="number"
                min={1}
                max={6}
                autoComplete="off"
                value={String(settings.homepage.productsLimit)}
                onChange={(value) => {
                  const parsed = Number.parseInt(value, 10);
                  const safe = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 6) : 6;
                  setSettings((prev) => ({
                    ...prev,
                    homepage: { ...prev.homepage, productsLimit: safe },
                  }));
                }}
              />
            </FormSection>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Why Us (Home section)
            </Text>

            <FormSection>
              <TextField
                label="Eyebrow"
                autoComplete="off"
                value={settings.whyUs.eyebrow}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    whyUs: { ...prev.whyUs, eyebrow: value },
                  }))
                }
              />

              <TextField
                label="Title"
                autoComplete="off"
                value={settings.whyUs.title}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    whyUs: { ...prev.whyUs, title: value },
                  }))
                }
              />

              <TextField
                label="Subtitle"
                autoComplete="off"
                multiline={2}
                value={settings.whyUs.subtitle}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    whyUs: { ...prev.whyUs, subtitle: value },
                  }))
                }
              />
            </FormSection>

            <Divider />

            <BlockStack gap="300">
              {settings.whyUs.cards.map((card, index) => (
                <Card key={`why-us-card-${index}`}>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      Card {index + 1}
                    </Text>
                    <TextField
                      label="Card title"
                      autoComplete="off"
                      value={card.title}
                      onChange={(value) => updateCard(index, 'title', value)}
                    />
                    <TextField
                      label="Card text"
                      autoComplete="off"
                      multiline={3}
                      value={card.text}
                      onChange={(value) => updateCard(index, 'text', value)}
                    />
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function FormSection({ children }: { children: ReactNode }) {
  return <BlockStack gap="300">{children}</BlockStack>;
}
