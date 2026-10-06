import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Reservation {
  name: string;
  note: string;
  created_at: string;
}

interface WishlistItem {
  id: number;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
  source: string;
  category: string;
  status: 'active' | 'reserved';
  created_at: string;
  sort_order: number;
  reservations: Reservation[];
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory items matching user's exact API contract
const items: WishlistItem[] = [
  {
    id: 1,
    title: 'Виниловый проигрыватель с латунным тонармом',
    description: 'Минималистичный корпус из массива ореха, ременной привод и теплый аналоговый звук для уютных вечеров.',
    price: 48500,
    currency: 'RUB',
    image_url: '/src/assets/images/wishlist_vinyl_player_1791319244750.jpg',
    product_url: 'https://example.com/audio/turntable-walnut',
    source: 'Audiophile Store',
    category: 'Электроника',
    status: 'active',
    created_at: '2026-09-10T14:20:00Z',
    sort_order: 1,
    reservations: [],
  },
  {
    id: 2,
    title: 'Кастомная механическая клавиатура',
    description: 'Корпус из анодированного алюминия, тактильные свитчи с заводской смазкой, латунный утяжелитель.',
    price: 32000,
    currency: 'RUB',
    image_url: '/src/assets/images/wishlist_mechanical_keyboard_1791319253863.jpg',
    product_url: 'https://example.com/custom-keyboard-graphite',
    source: 'Geekboards',
    category: 'Электроника',
    status: 'active',
    created_at: '2026-09-15T11:00:00Z',
    sort_order: 2,
    reservations: [],
  },
  {
    id: 3,
    title: 'Нишевый парфюм с нотами сандала и амбры',
    description: 'Глубокий древесно-кожаный аромат в лаконичном флаконе. Хватит на целый год вдохновения.',
    price: 24500,
    currency: 'RUB',
    image_url: '/src/assets/images/wishlist_lelabo_perfume_1791319225706.jpg',
    product_url: 'https://example.com/parfum-amber-santal',
    source: 'Le Labo / Molecule',
    category: 'Стиль & Уход',
    status: 'active',
    created_at: '2026-09-18T09:30:00Z',
    sort_order: 3,
    reservations: [],
  },
  {
    id: 4,
    title: 'Стеклянный пуровер Chemex с деревянным манжетом',
    description: 'Классика спешелти-кофе. Боросиликатное стекло ручной работы, кожаный шнур и деревянный воротник.',
    price: 8900,
    currency: 'RUB',
    image_url: '/src/assets/images/wishlist_chemex_coffee_1791319235128.jpg',
    product_url: 'https://example.com/coffee/chemex-classic',
    source: 'Кооператив Чёрный',
    category: 'Дом & Кофе',
    status: 'active',
    created_at: '2026-09-22T16:45:00Z',
    sort_order: 4,
    reservations: [],
  },
  {
    id: 5,
    title: 'Перьевая ручка с золотым пером 18k',
    description: 'Изящный пишущий инструмент для заметок, планов и подписи важных договоров в черном кожаном блокноте.',
    price: 18700,
    currency: 'RUB',
    image_url: '/src/assets/images/wishlist_fountain_pen_1791319263502.jpg',
    product_url: 'https://example.com/pens/fountain-gold-nib',
    source: 'AllTime',
    category: 'Канцелярия',
    status: 'active',
    created_at: '2026-09-25T13:10:00Z',
    sort_order: 5,
    reservations: [],
  },
  {
    id: 6,
    title: 'Настольная лампа в стиле Баухаус',
    description: 'Матовый металл, латунь и рассеянный теплый свет 2700K для чтения вечерами.',
    price: 15400,
    currency: 'RUB',
    image_url: '', // Test empty image fallback
    product_url: 'https://example.com/decor/bauhaus-lamp',
    source: 'Design Boom',
    category: 'Дом & Кофе',
    status: 'reserved', // Test already reserved state
    created_at: '2026-09-28T10:00:00Z',
    sort_order: 6,
    reservations: [
      {
        name: 'Миша и Лена',
        note: 'Забронировали, отдадим лично в руки на празднике!',
        created_at: '2026-09-29T12:00:00Z',
      },
    ],
  },
  {
    id: 7,
    title: 'Любая редкая книга по архитектуре или дизайну',
    description: 'Издательства Taschen, Phaidon или Strelka Press. Главное — чтобы вам самому было приятно её полистать.',
    price: null, // Test price null / priceless
    currency: 'RUB',
    image_url: '',
    product_url: '',
    source: 'Подписные издания',
    category: 'Книги',
    status: 'active',
    created_at: '2026-10-01T08:00:00Z',
    sort_order: 7,
    reservations: [],
  },
];

// API: GET /api/items
app.get('/api/items', (_req, res) => {
  res.json({ items });
});

// API: POST /api/reserve
app.post('/api/reserve', (req, res) => {
  const { item_id, name, note } = req.body;

  if (!item_id) {
    return res.status(400).json({ error: 'item_id is required' });
  }

  const item = items.find((it) => String(it.id) === String(item_id));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (item.status === 'reserved') {
    return res.status(409).json({ error: 'Item is already reserved' });
  }

  item.status = 'reserved';
  const newReservation = {
    name: name || 'Анонимный друг',
    note: note || '',
    created_at: new Date().toISOString(),
  };
  item.reservations.push(newReservation);

  return res.status(201).json({
    success: true,
    item,
    reservation: newReservation,
  });
});

async function startServer() {
  // Mount Vite middlewares for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
