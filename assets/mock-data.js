// Seed catalogue, customers, and order history for the demo store.
// Loaded after assets/ring-svg.js so RingSvg is available.
(function () {
  const ring = (window.RingSvg && window.RingSvg.ring) || (() => '');

  // ---------- Products (12 rings) ----------
  const PRODUCT_DEFINITIONS = [
    {
      id: 'prd_celestine',
      slug: 'celestine-solitaire',
      title: 'The Celestine',
      subtitle: 'Brilliant-cut diamond solitaire',
      description: `A single brilliant-cut diamond elevated above a softly tapered band. The Celestine is the atelier's reference solitaire — calm, certain, made to be worn for a lifetime.`,
      price_cents: 420000,
      metal: '18k Yellow Gold',
      stone: 'Diamond, 1.10ct',
      hand_size: 'UK J – Q',
      stock: 4,
      featured: true,
      style: { metal: 'gold', stone: 'diamond', style: 'solitaire' },
    },
    {
      id: 'prd_maris',
      slug: 'maris-halo',
      title: 'The Maris Halo',
      subtitle: 'Ceylon sapphire surrounded by pavé',
      description: `An untreated Ceylon sapphire of unusual depth, encircled by a halo of micro-set diamonds. Hand-finished in white gold to draw light into the stone.`,
      price_cents: 680000,
      metal: '18k White Gold',
      stone: 'Ceylon Sapphire, 1.40ct',
      hand_size: 'UK K – P',
      stock: 2,
      featured: true,
      style: { metal: 'white-gold', stone: 'sapphire', style: 'halo' },
    },
    {
      id: 'prd_jardin',
      slug: 'jardin-eternity',
      title: 'Jardin Éternité',
      subtitle: 'Emerald eternity band',
      description: `Twenty-six Colombian emeralds run the full circumference of the band, each held in a hand-cut bezel. A piece for the second decade of a story.`,
      price_cents: 840000,
      metal: '18k Yellow Gold',
      stone: 'Colombian Emerald, 2.10ct total',
      hand_size: 'Made to order',
      stock: 1,
      featured: false,
      style: { metal: 'gold', stone: 'emerald', style: 'eternity' },
    },
    {
      id: 'prd_aubade',
      slug: 'aubade-pave',
      title: 'Aubade Pavé',
      subtitle: 'Diamond crown in rose gold',
      description: `Nine pavé-set diamonds form a softly rising crown across the top of the band. Worn alone or stacked beside the Celestine.`,
      price_cents: 320000,
      metal: '18k Rose Gold',
      stone: 'Diamond, 0.65ct total',
      hand_size: 'UK H – P',
      stock: 6,
      featured: false,
      style: { metal: 'rose-gold', stone: 'diamond', style: 'pave' },
    },
    {
      id: 'prd_minuit',
      slug: 'minuit-signet',
      title: 'The Minuit Signet',
      subtitle: 'Hand-engraved oval signet',
      description: `A traditional gentleman's signet, with an oval face engraved by hand. Optionally personalised with an initial or family device on commission.`,
      price_cents: 195000,
      metal: '18k Yellow Gold',
      stone: 'None',
      hand_size: 'UK L – U',
      stock: 8,
      featured: false,
      style: { metal: 'gold', stone: 'diamond', style: 'signet' },
    },
    {
      id: 'prd_trinite',
      slug: 'trinite',
      title: 'Trinité',
      subtitle: 'Three-stone diamond in platinum',
      description: `Past, present, and to come — three brilliant-cut diamonds set in a low platinum band. A discreet alternative to the solitaire.`,
      price_cents: 920000,
      metal: 'Platinum 950',
      stone: 'Diamond, 1.85ct total',
      hand_size: 'UK I – P',
      stock: 2,
      featured: true,
      style: { metal: 'platinum', stone: 'diamond', style: 'threeStone' },
    },
    {
      id: 'prd_volupte',
      slug: 'volupte',
      title: 'Volupté',
      subtitle: 'Burmese ruby halo',
      description: `A pigeon-blood Burmese ruby cradled by a halo of diamonds, set in rose gold to warm the stone. Each ruby is selected on commission.`,
      price_cents: 540000,
      metal: '18k Rose Gold',
      stone: 'Burmese Ruby, 1.20ct',
      hand_size: 'UK J – O',
      stock: 1,
      featured: false,
      style: { metal: 'rose-gold', stone: 'ruby', style: 'halo' },
    },
    {
      id: 'prd_chant',
      slug: 'chant-dor',
      title: 'Chant d’Or',
      subtitle: 'Diamond eternity in yellow gold',
      description: `A continuous line of brilliant diamonds set into an 18k yellow gold band — the most generous of the eternity rings the atelier offers.`,
      price_cents: 720000,
      metal: '18k Yellow Gold',
      stone: 'Diamond, 1.95ct total',
      hand_size: 'Made to order',
      stock: 0,
      featured: false,
      style: { metal: 'gold', stone: 'diamond', style: 'eternity' },
    },
    {
      id: 'prd_beaumont',
      slug: 'beaumont',
      title: 'The Beaumont',
      subtitle: 'Morganite solitaire in rose gold',
      description: `A cushion-cut morganite of soft rose, on a tapered rose gold band. Considered, romantic, distinctly modern.`,
      price_cents: 240000,
      metal: '18k Rose Gold',
      stone: 'Morganite, 2.40ct',
      hand_size: 'UK J – P',
      stock: 5,
      featured: false,
      style: { metal: 'rose-gold', stone: 'morganite', style: 'solitaire' },
    },
    {
      id: 'prd_onyx',
      slug: 'onyx-sceau',
      title: 'Onyx Sceau',
      subtitle: 'Black onyx signet, white gold',
      description: `A flat black onyx face inlaid into a white gold signet. Quiet, architectural — designed to be worn every day.`,
      price_cents: 165000,
      metal: '18k White Gold',
      stone: 'Black Onyx',
      hand_size: 'UK L – U',
      stock: 4,
      featured: false,
      style: { metal: 'white-gold', stone: 'onyx', style: 'signet' },
    },
    {
      id: 'prd_aurora',
      slug: 'aurora',
      title: 'Aurora',
      subtitle: 'Amethyst three-stone',
      description: `Three graduated amethysts in 18k yellow gold, hand-set in a low rub-over collet. A piece with a quiet sense of theatre.`,
      price_cents: 480000,
      metal: '18k Yellow Gold',
      stone: 'Amethyst, 2.80ct total',
      hand_size: 'UK K – Q',
      stock: 3,
      featured: false,
      style: { metal: 'gold', stone: 'amethyst', style: 'threeStone' },
    },
    {
      id: 'prd_lumen',
      slug: 'lumen-halo',
      title: 'Lumen Halo',
      subtitle: 'Diamond halo in platinum',
      description: `A brilliant centre stone framed by a sweeping diamond halo and a pavé-set band — the most luminous of the atelier's halo settings.`,
      price_cents: 1150000,
      metal: 'Platinum 950',
      stone: 'Diamond, 2.40ct total',
      hand_size: 'Made to order',
      stock: 1,
      featured: true,
      style: { metal: 'platinum', stone: 'diamond', style: 'halo' },
    },
  ];

  // Today is fixed for the demo so order/customer dates stay coherent.
  const NOW = new Date('2026-04-22T16:00:00Z');
  const daysAgo = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();

  // Temporary placeholder image used for every seeded product. Swap per-product
  // images via the admin when real photography is available.
  const PLACEHOLDER_IMAGE = '/assets/ring-placeholder.jpg';

  const PRODUCTS = PRODUCT_DEFINITIONS.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    price_cents: p.price_cents,
    currency: 'GBP',
    images: [PLACEHOLDER_IMAGE],
    category: 'ring',
    metal: p.metal,
    stone: p.stone,
    hand_size: p.hand_size,
    stock: p.stock,
    published: true,
    featured: !!p.featured,
    created_at: daysAgo(180 - i * 8),
    updated_at: daysAgo(30 - (i % 12)),
  }));

  // ---------- Customers ----------
  const CUSTOMERS = [
    { id: 'cus_001', name: 'Eleanor Whitfield',  email: 'eleanor.whitfield@example.com', city: 'London',     country: 'United Kingdom', joined_at: daysAgo(180) },
    { id: 'cus_002', name: 'Marcus Adebayo',     email: 'marcus.adebayo@example.com',    city: 'Lagos',      country: 'Nigeria',         joined_at: daysAgo(165) },
    { id: 'cus_003', name: 'Sofia Castellano',   email: 'sofia.castellano@example.com',  city: 'Milan',      country: 'Italy',           joined_at: daysAgo(152) },
    { id: 'cus_004', name: 'Henrietta Park',     email: 'h.park@example.com',            city: 'New York',   country: 'United States',   joined_at: daysAgo(140) },
    { id: 'cus_005', name: 'Imogen Caldwell',    email: 'imogen.c@example.com',          city: 'Edinburgh',  country: 'United Kingdom',  joined_at: daysAgo(128) },
    { id: 'cus_006', name: 'Théodore Beaumont',  email: 'theo.beaumont@example.com',     city: 'Paris',      country: 'France',          joined_at: daysAgo(115) },
    { id: 'cus_007', name: 'Anastasia Volkov',   email: 'anastasia.v@example.com',       city: 'Geneva',     country: 'Switzerland',     joined_at: daysAgo(101) },
    { id: 'cus_008', name: 'Aldous Hartwell',    email: 'aldous.hartwell@example.com',   city: 'Bath',       country: 'United Kingdom',  joined_at: daysAgo(94)  },
    { id: 'cus_009', name: 'Cassia Renner',      email: 'cassia.renner@example.com',     city: 'Vienna',     country: 'Austria',         joined_at: daysAgo(86)  },
    { id: 'cus_010', name: 'Olamide Adesanya',   email: 'olamide.a@example.com',         city: 'Lagos',      country: 'Nigeria',         joined_at: daysAgo(74)  },
    { id: 'cus_011', name: 'Beatrice Sinclair',  email: 'beatrice.s@example.com',        city: 'Manhattan',  country: 'United States',   joined_at: daysAgo(68)  },
    { id: 'cus_012', name: 'Frédéric Laurent',   email: 'frederic.laurent@example.com',  city: 'Lyon',       country: 'France',          joined_at: daysAgo(60)  },
    { id: 'cus_013', name: 'Vivienne Marchetti', email: 'v.marchetti@example.com',       city: 'Florence',   country: 'Italy',           joined_at: daysAgo(54)  },
    { id: 'cus_014', name: 'Quentin Ashworth',   email: 'q.ashworth@example.com',        city: 'Oxford',     country: 'United Kingdom',  joined_at: daysAgo(46)  },
    { id: 'cus_015', name: 'Adaeze Eze',         email: 'adaeze.eze@example.com',        city: 'London',     country: 'United Kingdom',  joined_at: daysAgo(40)  },
    { id: 'cus_016', name: 'Kazimir Petrov',     email: 'k.petrov@example.com',          city: 'Berlin',     country: 'Germany',         joined_at: daysAgo(33)  },
    { id: 'cus_017', name: 'Claudia Wexford',    email: 'claudia.w@example.com',         city: 'Dublin',     country: 'Ireland',         joined_at: daysAgo(28)  },
    { id: 'cus_018', name: 'Augusto Romano',     email: 'augusto.r@example.com',         city: 'Rome',       country: 'Italy',           joined_at: daysAgo(20)  },
    { id: 'cus_019', name: 'Margaux Delacroix',  email: 'margaux.d@example.com',         city: 'Paris',      country: 'France',          joined_at: daysAgo(13)  },
    { id: 'cus_020', name: 'Constantin Roussos', email: 'c.roussos@example.com',         city: 'Athens',     country: 'Greece',          joined_at: daysAgo(6)   },
  ];

  // ---------- Orders ----------
  // Mix of statuses — pending (just placed), paid (awaiting fulfilment),
  // fulfilled (delivered), refunded.
  const ORDER_DEFINITIONS = [
    { customer: 'cus_001', items: [['prd_celestine', 1]], status: 'fulfilled', daysAgo: 175 },
    { customer: 'cus_002', items: [['prd_minuit', 1]],     status: 'fulfilled', daysAgo: 162 },
    { customer: 'cus_003', items: [['prd_maris', 1]],      status: 'fulfilled', daysAgo: 148 },
    { customer: 'cus_004', items: [['prd_aubade', 1], ['prd_celestine', 1]], status: 'fulfilled', daysAgo: 140 },
    { customer: 'cus_005', items: [['prd_jardin', 1]],     status: 'fulfilled', daysAgo: 121 },
    { customer: 'cus_006', items: [['prd_volupte', 1]],    status: 'fulfilled', daysAgo: 108 },
    { customer: 'cus_001', items: [['prd_aubade', 1]],     status: 'fulfilled', daysAgo: 96  },
    { customer: 'cus_007', items: [['prd_lumen', 1]],      status: 'fulfilled', daysAgo: 88  },
    { customer: 'cus_008', items: [['prd_minuit', 1]],     status: 'refunded',  daysAgo: 80  },
    { customer: 'cus_009', items: [['prd_trinite', 1]],    status: 'fulfilled', daysAgo: 72  },
    { customer: 'cus_010', items: [['prd_beaumont', 1]],   status: 'fulfilled', daysAgo: 64  },
    { customer: 'cus_011', items: [['prd_chant', 1]],      status: 'fulfilled', daysAgo: 58  },
    { customer: 'cus_012', items: [['prd_onyx', 1]],       status: 'fulfilled', daysAgo: 50  },
    { customer: 'cus_004', items: [['prd_aurora', 1]],     status: 'fulfilled', daysAgo: 44  },
    { customer: 'cus_013', items: [['prd_aubade', 2]],     status: 'fulfilled', daysAgo: 38  },
    { customer: 'cus_014', items: [['prd_celestine', 1]],  status: 'fulfilled', daysAgo: 32  },
    { customer: 'cus_015', items: [['prd_maris', 1]],      status: 'fulfilled', daysAgo: 26  },
    { customer: 'cus_016', items: [['prd_minuit', 1]],     status: 'fulfilled', daysAgo: 21  },
    { customer: 'cus_001', items: [['prd_lumen', 1]],      status: 'paid',      daysAgo: 16  },
    { customer: 'cus_017', items: [['prd_jardin', 1]],     status: 'paid',      daysAgo: 12  },
    { customer: 'cus_018', items: [['prd_volupte', 1]],    status: 'paid',      daysAgo: 9   },
    { customer: 'cus_019', items: [['prd_aubade', 1], ['prd_minuit', 1]], status: 'paid', daysAgo: 6 },
    { customer: 'cus_020', items: [['prd_beaumont', 1]],   status: 'paid',      daysAgo: 4   },
    { customer: 'cus_011', items: [['prd_trinite', 1]],    status: 'pending',   daysAgo: 2   },
    { customer: 'cus_006', items: [['prd_celestine', 1]],  status: 'pending',   daysAgo: 1   },
  ];

  const findProduct = (id) => PRODUCTS.find((p) => p.id === id);
  const findCustomer = (id) => CUSTOMERS.find((c) => c.id === id);

  const SHIPPING_FLAT_CENTS = 0; // White-glove courier included.

  const ORDERS = ORDER_DEFINITIONS.map((def, i) => {
    const items = def.items.map(([pid, qty]) => {
      const p = findProduct(pid);
      return {
        product_id: pid,
        title: p.title,
        image: p.images[0],
        quantity: qty,
        price_cents: p.price_cents,
      };
    });
    const subtotal = items.reduce((s, it) => s + it.price_cents * it.quantity, 0);
    const c = findCustomer(def.customer);
    const num = String(1042 + i).padStart(4, '0');
    return {
      id: `ord_${num}`,
      number: `MA-${num}`,
      customer_id: def.customer,
      customer_email: c.email,
      customer_name: c.name,
      items,
      subtotal_cents: subtotal,
      shipping_cents: SHIPPING_FLAT_CENTS,
      discount_cents: 0,
      discount_code: '',
      total_cents: subtotal + SHIPPING_FLAT_CENTS,
      currency: 'GBP',
      status: def.status,
      created_at: daysAgo(def.daysAgo),
      shipping_address: {
        line1: '—',
        city: c.city,
        postal: '',
        country: c.country,
      },
    };
  });

  // ---------- Email templates ----------
  const EMAIL_TEMPLATES = [
    {
      key: 'welcome',
      name: 'Welcome',
      description: 'Sent to new accounts and waitlist signups.',
      subject: 'Welcome to Maliki Atelier',
      body: `Dear {{name}},

Thank you for joining the Maliki private list. From this moment, you will hear of new pieces before all else — quietly, and only when there is something worth hearing of.

Should you wish to commission a piece, the atelier is at your disposal.

— Maliki Atelier
By Appointment`,
      enabled: true,
      updated_at: daysAgo(48),
    },
    {
      key: 'order_confirmation',
      name: 'Order confirmation',
      description: 'Sent the moment an order is placed.',
      subject: 'Your order, {{order_number}}, has been received',
      body: `Dear {{name}},

Your order {{order_number}} has been received and is being prepared at the atelier.

A member of the team will contact you within forty-eight hours to confirm hand size and arrange your white-glove delivery.

With care,
— Maliki Atelier`,
      enabled: true,
      updated_at: daysAgo(35),
    },
    {
      key: 'shipped',
      name: 'Order shipped',
      description: 'Sent when an order is fulfilled.',
      subject: 'Your piece is on its way',
      body: `Dear {{name}},

Your order {{order_number}} has left the atelier in the hands of our courier and will be delivered to you in person.

You will be contacted on the morning of arrival to confirm a window.

— Maliki Atelier`,
      enabled: true,
      updated_at: daysAgo(28),
    },
    {
      key: 'abandoned_cart',
      name: 'Abandoned cart',
      description: 'Sent 24 hours after a cart is abandoned.',
      subject: 'A piece is waiting for you',
      body: `Dear {{name}},

The piece you were considering remains in your cart. Should you wish to take it further, the atelier is on hand to answer any question — on metal, stone, or sizing.

— Maliki Atelier`,
      enabled: false,
      updated_at: daysAgo(60),
    },
    {
      key: 'back_in_stock',
      name: 'Back in stock',
      description: 'Sent when a notified piece is restocked.',
      subject: '{{product}} is once again available',
      body: `Dear {{name}},

The piece you registered interest in — {{product}} — is once again available. Quantities are limited.

— Maliki Atelier`,
      enabled: false,
      updated_at: daysAgo(52),
    },
    {
      key: 'newsletter',
      name: 'Atelier journal (newsletter)',
      description: 'Periodic editorial sent to subscribers.',
      subject: 'From the atelier — this season',
      body: `Dear {{name}},

A short note from the atelier on the season's commissions, the stones we have been sourcing, and a piece that is about to be released to the private list.

— Maliki Atelier`,
      enabled: true,
      updated_at: daysAgo(14),
    },
    {
      key: 'vip_welcome',
      name: 'VIP welcome',
      description: 'Sent automatically when a customer places their first order over £1,000.',
      subject: 'Welcome to the Maliki private circle',
      body: `Dear {{name}},

Your first commission marks the beginning of a continued relationship with the atelier. From this moment, you will have access to private previews, early releases, and a dedicated point of contact.

We look forward to creating many pieces for you.

— Maliki Atelier`,
      enabled: false,
      updated_at: daysAgo(7),
    },
    {
      key: 'payment_failed',
      name: 'Payment failed',
      description: 'Sent automatically when a payment is declined at checkout.',
      subject: 'There was an issue with your payment — Order {{order_number}}',
      body: `Dear {{name}},

We were unable to process the payment for your order {{order_number}}. No charge has been made.

If you would like to try again or use a different card, please return to checkout. The atelier team is also on hand if you would prefer to arrange payment directly.

— Maliki Atelier`,
      enabled: false,
      updated_at: daysAgo(7),
    },
  ];

  // ---------- Email log (sent emails) ----------
  // Generated from orders + customers so it stays coherent with the rest of
  // the demo data.
  const STATUSES = ['delivered', 'opened', 'opened', 'opened', 'bounced'];
  const pickStatus = (i) => STATUSES[i % STATUSES.length];

  const EMAIL_LOG = [];
  let emailSeq = 9000;
  const pushEmail = (e) => {
    EMAIL_LOG.push({
      id: `em_${emailSeq++}`,
      ...e,
    });
  };

  // Welcome email per customer.
  CUSTOMERS.forEach((c, i) => {
    pushEmail({
      template_key: 'welcome',
      recipient_email: c.email,
      recipient_name: c.name,
      subject: 'Welcome to Maliki Atelier',
      status: pickStatus(i),
      sent_at: c.joined_at,
      opened_at: pickStatus(i) === 'opened' ? daysAgo(Math.max(0, Math.floor((Date.now() - new Date(c.joined_at).getTime()) / 86400000) - 1)) : null,
    });
  });

  // Order confirmation per order.
  ORDERS.forEach((o, i) => {
    pushEmail({
      template_key: 'order_confirmation',
      recipient_email: o.customer_email,
      recipient_name: o.customer_name,
      order_id: o.id,
      subject: `Your order, ${o.number}, has been received`,
      status: pickStatus(i + 3),
      sent_at: o.created_at,
      opened_at: pickStatus(i + 3) === 'opened' ? o.created_at : null,
    });
    if (o.status === 'fulfilled') {
      pushEmail({
        template_key: 'shipped',
        recipient_email: o.customer_email,
        recipient_name: o.customer_name,
        order_id: o.id,
        subject: 'Your piece is on its way',
        status: pickStatus(i + 5),
        sent_at: daysAgo(Math.max(0, Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000) - 2)),
        opened_at: null,
      });
    }
  });

  // A few newsletter sends.
  CUSTOMERS.slice(0, 12).forEach((c, i) => {
    pushEmail({
      template_key: 'newsletter',
      recipient_email: c.email,
      recipient_name: c.name,
      subject: 'From the atelier — this season',
      status: pickStatus(i + 7),
      sent_at: daysAgo(14),
      opened_at: pickStatus(i + 7) === 'opened' ? daysAgo(13) : null,
    });
  });

  // Sort newest first.
  EMAIL_LOG.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

  // ---------- Subscribers ----------
  // Mix of waitlist (from /api/notify) + checkout signups.
  const SUBSCRIBER_NAMES = [
    'celeste.morgan@example.com', 'r.dupont@example.com', 'h.azuma@example.com',
    'jasper.kane@example.com', 'naomi.shaw@example.com', 'priya.iyer@example.com',
    'olivia.bryce@example.com', 'finn.delacroix@example.com', 'i.aldana@example.com',
    'matteo.ferri@example.com', 'sienna.parr@example.com', 'lucas.bauer@example.com',
    'hannah.flynn@example.com', 'tariq.benali@example.com', 'ines.aldecoa@example.com',
    'rowan.holt@example.com', 'simone.luca@example.com', 'kenji.aoki@example.com',
    'aurelie.bertin@example.com', 'caspar.ohrn@example.com', 'mira.davies@example.com',
    'noor.haddad@example.com', 'leila.osman@example.com', 'iris.brandt@example.com',
    'felix.linden@example.com',
  ];
  const SUBSCRIBERS = SUBSCRIBER_NAMES.map((email, i) => ({
    id: `sub_${String(2000 + i).padStart(4, '0')}`,
    email,
    source: i % 4 === 0 ? 'checkout' : 'waitlist',
    status: i === 14 ? 'unsubscribed' : 'subscribed',
    subscribed_at: daysAgo(150 - i * 5),
  }));
  // Seed with checkout-source entries for our existing customers too.
  CUSTOMERS.forEach((c, i) => {
    SUBSCRIBERS.push({
      id: `sub_c${i}`,
      email: c.email,
      source: 'checkout',
      status: 'subscribed',
      subscribed_at: c.joined_at,
    });
  });
  SUBSCRIBERS.sort((a, b) => new Date(b.subscribed_at) - new Date(a.subscribed_at));

  // ---------- Discounts ----------
  const DISCOUNTS = [
    {
      id: 'disc_atelier10',
      code: 'ATELIER10',
      type: 'percent',
      value: 10,
      minimum_cents: 0,
      applies_to: 'all',
      status: 'active',
      starts_at: daysAgo(60),
      ends_at: null,
      usage_count: 14,
      usage_limit: null,
      description: 'A standing discount for the private list.',
    },
    {
      id: 'disc_welcome50',
      code: 'WELCOME50',
      type: 'fixed',
      value: 5000,
      minimum_cents: 200000,
      applies_to: 'all',
      status: 'active',
      starts_at: daysAgo(120),
      ends_at: null,
      usage_count: 38,
      usage_limit: null,
      description: '£50 off a first order over £2,000.',
    },
    {
      id: 'disc_summer25',
      code: 'SUMMER25',
      type: 'percent',
      value: 15,
      minimum_cents: 100000,
      applies_to: 'all',
      status: 'expired',
      starts_at: daysAgo(220),
      ends_at: daysAgo(190),
      usage_count: 47,
      usage_limit: 100,
      description: 'Limited summer collection promotion.',
    },
    {
      id: 'disc_press',
      code: 'PRESS',
      type: 'percent',
      value: 25,
      minimum_cents: 0,
      applies_to: 'all',
      status: 'active',
      starts_at: daysAgo(180),
      ends_at: null,
      usage_count: 6,
      usage_limit: 25,
      description: 'For invited press and editorial partners.',
    },
    {
      id: 'disc_vip',
      code: 'VIP100',
      type: 'fixed',
      value: 10000,
      minimum_cents: 500000,
      applies_to: 'all',
      status: 'scheduled',
      starts_at: daysAgo(-7),
      ends_at: daysAgo(-37),
      usage_count: 0,
      usage_limit: 50,
      description: 'For the autumn private viewing.',
    },
  ];

  // ---------- Pages (CMS) ----------
  const PAGES = [
    {
      id: 'pg_about',
      slug: 'about',
      title: 'About the Atelier',
      status: 'published',
      body: `Maliki Atelier was founded as a quiet response to the noise of the modern jewellery industry — a return to the practice of making one piece at a time, by hand, for a person whose name we know.

Each ring is hand-finished in our London workshop, in metals we cast ourselves from recycled gold and platinum, and stones sourced through long-standing relationships in Antwerp, Bogotá, and Yangon.`,
      updated_at: daysAgo(40),
    },
    {
      id: 'pg_craft',
      slug: 'craftsmanship',
      title: 'Our Craftsmanship',
      status: 'published',
      body: `Every piece passes through three hands before it is sent: a goldsmith, a setter, and the final polisher. The total time at the bench, for a solitaire, is between 38 and 52 hours.`,
      updated_at: daysAgo(20),
    },
    {
      id: 'pg_shipping',
      slug: 'shipping-and-returns',
      title: 'Shipping & Returns',
      status: 'published',
      body: `All orders are dispatched by white-glove courier, fully insured, and signed for in person.

Returns are accepted within 14 days for an unworn piece in its original presentation case. Commissioned pieces are non-returnable.`,
      updated_at: daysAgo(12),
    },
    {
      id: 'pg_care',
      slug: 'care',
      title: 'Care of Your Piece',
      status: 'published',
      body: `Remove your ring before sleep, exercise, gardening, or contact with chlorinated water. We offer complimentary inspection and re-polish for the lifetime of any piece.`,
      updated_at: daysAgo(80),
    },
    {
      id: 'pg_contact',
      slug: 'contact',
      title: 'Contact',
      status: 'draft',
      body: `By appointment only. Please write to atelier@malikiatelier.com to arrange a private viewing.`,
      updated_at: daysAgo(3),
    },
  ];

  // ---------- Settings ----------
  const SETTINGS = {
    general: {
      store_name: 'Maliki Atelier',
      store_email: 'atelier@malikiatelier.com',
      currency: 'GBP',
      timezone: 'Europe/London',
      address: '12 Hatton Garden, London EC1N',
    },
    branding: {
      accent_color: '#d9b070',
      logo_text: 'Maliki',
    },
    integrations: {
      stripe:   { connected: false, label: 'Stripe (payments)' },
      resend:   { connected: true,  label: 'Resend (transactional email)' },
      klaviyo:  { connected: false, label: 'Klaviyo (marketing)' },
      googleAnalytics: { connected: false, label: 'Google Analytics' },
      meta:     { connected: false, label: 'Meta Pixel' },
    },
    notifications: {
      new_order: true,
      cancelled_order: true,
      new_subscriber: false,
      low_stock: true,
      weekly_summary: true,
    },
    shipping: {
      flat_rate_cents: 0,
      free_threshold_cents: 0,
      countries_serviced: 'Worldwide (EU, UK, US, CA, AU, JP, SG, AE, NG, ZA)',
      courier: 'White-glove (Ferrari Express)',
    },
    legal: {
      terms_url: 'https://www.malikiatelier.com/legal/terms',
      privacy_url: 'https://www.malikiatelier.com/legal/privacy',
      company_number: 'GB 14729118',
    },
  };

  window.MOCK_DATA = {
    products: PRODUCTS,
    customers: CUSTOMERS,
    orders: ORDERS,
    email_templates: EMAIL_TEMPLATES,
    email_log: EMAIL_LOG,
    subscribers: SUBSCRIBERS,
    discounts: DISCOUNTS,
    pages: PAGES,
    settings: SETTINGS,
    seed_version: 5,
  };
})();
