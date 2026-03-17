import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  adminGraphql,
  exchangeForAdminAccessToken,
  getShopFromSessionPayload,
  getShopifyEnv,
  verifySessionToken,
} from './shopify.js';

dotenv.config();

const env = getShopifyEnv();
const app = express();
const port = Number.parseInt(process.env.PORT ?? '3001', 10);

type Metafield = { value: string | null } | null;

interface SettingsQueryData {
  shop: {
    id: string;
    gsapEnabled: Metafield;
    gsapQuality: Metafield;
    gsapEnableDesktop: Metafield;
    gsapEnableMobile: Metafield;
    homepageFeaturedCollectionHandle: Metafield;
    homepageProductsLimit: Metafield;
    whyUsEyebrow: Metafield;
    whyUsTitle: Metafield;
    whyUsSubtitle: Metafield;
    whyUsItem1Title: Metafield;
    whyUsItem1Text: Metafield;
    whyUsItem2Title: Metafield;
    whyUsItem2Text: Metafield;
    whyUsItem3Title: Metafield;
    whyUsItem3Text: Metafield;
    whyUsItem4Title: Metafield;
    whyUsItem4Text: Metafield;
  };
  collections: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
    }>;
  };
}

interface ShopIdQueryData {
  shop: { id: string };
}

interface MetafieldsSetData {
  metafieldsSet: {
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

interface MetafieldsDeleteData {
  metafieldsDelete: {
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

const SETTINGS_QUERY = /* GraphQL */ `
  query ThemeSettingsContext {
    shop {
      id
      gsapEnabled: metafield(namespace: "kor_theme", key: "gsap_enabled") { value }
      gsapQuality: metafield(namespace: "kor_theme", key: "gsap_quality") { value }
      gsapEnableDesktop: metafield(namespace: "kor_theme", key: "gsap_enable_desktop") { value }
      gsapEnableMobile: metafield(namespace: "kor_theme", key: "gsap_enable_mobile") { value }
      homepageFeaturedCollectionHandle: metafield(namespace: "kor_theme", key: "homepage_featured_collection_handle") { value }
      homepageProductsLimit: metafield(namespace: "kor_theme", key: "homepage_products_limit") { value }
      whyUsEyebrow: metafield(namespace: "kor_theme", key: "why_us_eyebrow") { value }
      whyUsTitle: metafield(namespace: "kor_theme", key: "why_us_title") { value }
      whyUsSubtitle: metafield(namespace: "kor_theme", key: "why_us_subtitle") { value }
      whyUsItem1Title: metafield(namespace: "kor_theme", key: "why_us_item_1_title") { value }
      whyUsItem1Text: metafield(namespace: "kor_theme", key: "why_us_item_1_text") { value }
      whyUsItem2Title: metafield(namespace: "kor_theme", key: "why_us_item_2_title") { value }
      whyUsItem2Text: metafield(namespace: "kor_theme", key: "why_us_item_2_text") { value }
      whyUsItem3Title: metafield(namespace: "kor_theme", key: "why_us_item_3_title") { value }
      whyUsItem3Text: metafield(namespace: "kor_theme", key: "why_us_item_3_text") { value }
      whyUsItem4Title: metafield(namespace: "kor_theme", key: "why_us_item_4_title") { value }
      whyUsItem4Text: metafield(namespace: "kor_theme", key: "why_us_item_4_text") { value }
    }
    collections(first: 50, sortKey: TITLE) {
      nodes {
        id
        title
        handle
      }
    }
  }
`;

const SHOP_ID_QUERY = /* GraphQL */ `
  query ShopId {
    shop {
      id
    }
  }
`;

const METAFIELDS_SET_MUTATION = /* GraphQL */ `
  mutation SetThemeMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }
`;

const METAFIELDS_DELETE_MUTATION = /* GraphQL */ `
  mutation DeleteThemeMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }
`;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', async (req, res, next) => {
  if (req.path === '/health') {
    next();
    return;
  }

  try {
    const authHeader = req.header('authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      res.status(401).json({ error: 'Missing App Bridge session token' });
      return;
    }

    const sessionToken = authHeader.slice('bearer '.length).trim();
    if (!sessionToken) {
      res.status(401).json({ error: 'Missing App Bridge session token' });
      return;
    }

    const payload = await verifySessionToken(sessionToken, env);
    const shop = getShopFromSessionPayload(payload);
    const adminAccessToken = await exchangeForAdminAccessToken(shop, sessionToken, env);

    res.locals.shop = shop;
    res.locals.adminAccessToken = adminAccessToken;

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/settings', async (_req, res) => {
  try {
    const shop = String(res.locals.shop);
    const accessToken = String(res.locals.adminAccessToken);

    const data = await adminGraphql<SettingsQueryData>(shop, accessToken, SETTINGS_QUERY);

    const productsLimitRaw = Number.parseInt(data.shop.homepageProductsLimit?.value ?? '6', 10);
    const productsLimit = Number.isFinite(productsLimitRaw)
      ? Math.min(Math.max(productsLimitRaw, 1), 6)
      : 6;

    const settings = {
      gsap: {
        enabled: parseBoolean(data.shop.gsapEnabled?.value, true),
        quality: parseQuality(data.shop.gsapQuality?.value),
        enableDesktop: parseBoolean(data.shop.gsapEnableDesktop?.value, true),
        enableMobile: parseBoolean(data.shop.gsapEnableMobile?.value, true),
      },
      homepage: {
        featuredCollectionHandle: (data.shop.homepageFeaturedCollectionHandle?.value ?? '').trim(),
        productsLimit,
      },
      whyUs: {
        eyebrow: data.shop.whyUsEyebrow?.value ?? 'Why Kor',
        title: data.shop.whyUsTitle?.value ?? 'Less noise. More criteria.',
        subtitle:
          data.shop.whyUsSubtitle?.value ??
          'Kor creates products with clean aesthetics, premium materials, and an experience built for people who value detail.',
        cards: [
          {
            title: data.shop.whyUsItem1Title?.value ?? 'Design with intent',
            text:
              data.shop.whyUsItem1Text?.value ??
              'Every piece exists for a reason: form, function, and detail in balance.',
          },
          {
            title: data.shop.whyUsItem2Title?.value ?? 'Premium materials',
            text:
              data.shop.whyUsItem2Text?.value ??
              'Finishes and textures you can feel from the first touch.',
          },
          {
            title: data.shop.whyUsItem3Title?.value ?? 'Precise details',
            text:
              data.shop.whyUsItem3Text?.value ??
              'Nothing extra. Nothing distracting. Every element is crafted to last.',
          },
          {
            title: data.shop.whyUsItem4Title?.value ?? 'Kor experience',
            text:
              data.shop.whyUsItem4Text?.value ??
              'Shopping, presentation, and use with a premium feel from start to finish.',
          },
        ],
      },
    };

    res.json({
      shop,
      settings,
      collections: data.collections.nodes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load settings';
    res.status(500).json({ error: message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const shop = String(res.locals.shop);
    const accessToken = String(res.locals.adminAccessToken);

    const settings = normalizeIncomingSettings(req.body?.settings);

    const shopData = await adminGraphql<ShopIdQueryData>(shop, accessToken, SHOP_ID_QUERY);
    const ownerId = shopData.shop.id;

    const metafields = [
      toMetafield(ownerId, 'gsap_enabled', 'boolean', String(settings.gsap.enabled)),
      toMetafield(ownerId, 'gsap_quality', 'single_line_text_field', settings.gsap.quality),
      toMetafield(ownerId, 'gsap_enable_desktop', 'boolean', String(settings.gsap.enableDesktop)),
      toMetafield(ownerId, 'gsap_enable_mobile', 'boolean', String(settings.gsap.enableMobile)),
      toMetafield(
        ownerId,
        'homepage_products_limit',
        'number_integer',
        String(settings.homepage.productsLimit)
      ),
    ];

    const textMetafields = [
      toOptionalTextMetafield(
        ownerId,
        'homepage_featured_collection_handle',
        'single_line_text_field',
        settings.homepage.featuredCollectionHandle
      ),
      toOptionalTextMetafield(ownerId, 'why_us_eyebrow', 'single_line_text_field', settings.whyUs.eyebrow),
      toOptionalTextMetafield(ownerId, 'why_us_title', 'single_line_text_field', settings.whyUs.title),
      toOptionalTextMetafield(ownerId, 'why_us_subtitle', 'multi_line_text_field', settings.whyUs.subtitle),
      toOptionalTextMetafield(ownerId, 'why_us_item_1_title', 'single_line_text_field', settings.whyUs.cards[0].title),
      toOptionalTextMetafield(ownerId, 'why_us_item_1_text', 'multi_line_text_field', settings.whyUs.cards[0].text),
      toOptionalTextMetafield(ownerId, 'why_us_item_2_title', 'single_line_text_field', settings.whyUs.cards[1].title),
      toOptionalTextMetafield(ownerId, 'why_us_item_2_text', 'multi_line_text_field', settings.whyUs.cards[1].text),
      toOptionalTextMetafield(ownerId, 'why_us_item_3_title', 'single_line_text_field', settings.whyUs.cards[2].title),
      toOptionalTextMetafield(ownerId, 'why_us_item_3_text', 'multi_line_text_field', settings.whyUs.cards[2].text),
      toOptionalTextMetafield(ownerId, 'why_us_item_4_title', 'single_line_text_field', settings.whyUs.cards[3].title),
      toOptionalTextMetafield(ownerId, 'why_us_item_4_text', 'multi_line_text_field', settings.whyUs.cards[3].text),
    ];

    const deleteMetafields: Array<{ ownerId: string; namespace: string; key: string }> = [];
    textMetafields.forEach((entry) => {
      if (entry.mode === 'set') {
        metafields.push(entry.metafield);
      } else {
        deleteMetafields.push(entry.identifier);
      }
    });

    const payload = await adminGraphql<MetafieldsSetData>(
      shop,
      accessToken,
      METAFIELDS_SET_MUTATION,
      { metafields }
    );

    if (payload.metafieldsSet.userErrors.length > 0) {
      const firstError = payload.metafieldsSet.userErrors[0];
      throw new Error(firstError.message);
    }

    if (deleteMetafields.length > 0) {
      const deletePayload = await adminGraphql<MetafieldsDeleteData>(
        shop,
        accessToken,
        METAFIELDS_DELETE_MUTATION,
        { metafields: deleteMetafields }
      );

      if (deletePayload.metafieldsDelete.userErrors.length > 0) {
        const firstError = deletePayload.metafieldsDelete.userErrors[0];
        throw new Error(firstError.message);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save settings';
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Kor Theme Control Center API listening on ${port}`);
});

function toMetafield(ownerId: string, key: string, type: string, value: string) {
  return {
    ownerId,
    namespace: 'kor_theme',
    key,
    type,
    value,
  };
}

function toOptionalTextMetafield(ownerId: string, key: string, type: string, value: string) {
  const normalized = String(value ?? '').trim();

  if (normalized === '') {
    return {
      mode: 'delete' as const,
      identifier: {
        ownerId,
        namespace: 'kor_theme',
        key,
      },
    };
  }

  return {
    mode: 'set' as const,
    metafield: toMetafield(ownerId, key, type, normalized),
  };
}

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value == null) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseQuality(value: string | null | undefined): 'high' | 'balanced' | 'low' {
  if (value === 'high' || value === 'low' || value === 'balanced') return value;
  return 'balanced';
}

function normalizeIncomingSettings(payload: unknown) {
  const source = (payload ?? {}) as Record<string, unknown>;

  const gsapSource = (source.gsap ?? {}) as Record<string, unknown>;
  const homepageSource = (source.homepage ?? {}) as Record<string, unknown>;
  const whyUsSource = (source.whyUs ?? {}) as Record<string, unknown>;
  const cardsSource = Array.isArray(whyUsSource.cards) ? whyUsSource.cards : [];

  const quality = parseQuality(String(gsapSource.quality ?? 'balanced'));

  const productsLimitRaw = Number.parseInt(String(homepageSource.productsLimit ?? 6), 10);
  const productsLimit = Number.isFinite(productsLimitRaw)
    ? Math.min(Math.max(productsLimitRaw, 1), 6)
    : 6;

  const cards = Array.from({ length: 4 }, (_, index) => {
    const card = (cardsSource[index] ?? {}) as Record<string, unknown>;
    return {
      title: String(card.title ?? ''),
      text: String(card.text ?? ''),
    };
  });

  return {
    gsap: {
      enabled: parseBooleanInput(gsapSource.enabled, true),
      quality,
      enableDesktop: parseBooleanInput(gsapSource.enableDesktop, true),
      enableMobile: parseBooleanInput(gsapSource.enableMobile, true),
    },
    homepage: {
      featuredCollectionHandle: String(homepageSource.featuredCollectionHandle ?? ''),
      productsLimit,
    },
    whyUs: {
      eyebrow: String(whyUsSource.eyebrow ?? 'Why Kor'),
      title: String(whyUsSource.title ?? 'Less noise. More criteria.'),
      subtitle: String(
        whyUsSource.subtitle ??
          'Kor creates products with clean aesthetics, premium materials, and an experience built for people who value detail.'
      ),
      cards,
    },
  };
}

function parseBooleanInput(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}
