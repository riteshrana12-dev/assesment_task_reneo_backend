import { getSupabaseAdmin } from "../config/supabase";

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Home & Kitchen",
  "Books",
  "Toys",
  "Sports",
  "Beauty",
  "Groceries",
];
const ADJECTIVES = [
  "Premium",
  "Classic",
  "Deluxe",
  "Compact",
  "Portable",
  "Wireless",
  "Eco-Friendly",
  "Handmade",
  "Vintage",
  "Modern",
];
const NOUNS = [
  "Backpack",
  "Blender",
  "Headphones",
  "Lamp",
  "Sneakers",
  "Notebook",
  "Watch",
  "Chair",
  "Bottle",
  "Speaker",
  "Jacket",
  "Mug",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomProductName(): string {
  return `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`;
}

async function seed() {
  const admin = getSupabaseAdmin();

  console.log("Creating seed sellers...");

  const sellerIds: string[] = [];
  const storeIds: string[] = [];

  // Create 20 fake sellers, each with one store — enough spread that
  // search/pagination results aren't dominated by a single seller's catalogue.
  for (let i = 0; i < 20; i++) {
    const email = `seed-seller-${i}@test.com`;

    const { data: userData, error: userError } =
      await admin.auth.admin.createUser({
        email,
        password: "SeedPass123!",
        email_confirm: true,
      });

    let userId: string;
    if (userError) {
      if (!userError.message.includes("already been registered")) {
        console.error(`Failed to create ${email}:`, userError.message);
        continue;
      }
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing.users.find(
        (u: { id: string; email?: string }) => u.email === email,
      );
      if (!found) continue;
      userId = found.id;
    } else {
      userId = userData.user.id;
    }

    await admin
      .from("profiles")
      .upsert({ id: userId, role: "SELLER", full_name: `Seed Seller ${i}` });

    const { data: existingStore } = await admin
      .from("stores")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    let storeId: string;
    if (existingStore) {
      storeId = existingStore.id;
    } else {
      const { data: newStore, error: storeError } = await admin
        .from("stores")
        .insert({ owner_id: userId, name: `Seed Store ${i}` })
        .select("id")
        .single();
      if (storeError) {
        console.error(
          `Failed to create store for ${email}:`,
          storeError.message,
        );
        continue;
      }
      storeId = newStore.id;
    }

    sellerIds.push(userId);
    storeIds.push(storeId);
  }

  console.log(
    `Created/found ${storeIds.length} seed stores. Generating products...`,
  );

  // Batch insert products — 10,000 across the seed stores, in chunks
  // (Supabase/Postgres handles large single inserts poorly; chunking is safer).
  const TOTAL_PRODUCTS = 10000;
  const BATCH_SIZE = 500;
  let created = 0;

  for (
    let batchStart = 0;
    batchStart < TOTAL_PRODUCTS;
    batchStart += BATCH_SIZE
  ) {
    const batch = [];
    const batchCount = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - batchStart);

    for (let i = 0; i < batchCount; i++) {
      batch.push({
        store_id: randomFrom(storeIds),
        name: randomProductName(),
        description: "Seed data for search/pagination testing.",
        category: randomFrom(CATEGORIES),
        price_cents: Math.floor(Math.random() * 20000) + 500,
        is_available: Math.random() > 0.1,
        is_archived: false,
      });
    }

    const { data: inserted, error: insertError } = await admin
      .from("products")
      .insert(batch)
      .select("id");

    if (insertError) {
      console.error(
        `Batch starting at ${batchStart} failed:`,
        insertError.message,
      );
      continue;
    }

    // Create matching inventory rows for this batch.
    const inventoryRows = inserted.map((p: { id: string }) => ({
      product_id: p.id,
      stock: Math.floor(Math.random() * 100),
    }));

    const { error: invError } = await admin
      .from("inventory")
      .insert(inventoryRows);
    if (invError) {
      console.error(
        `Inventory batch starting at ${batchStart} failed:`,
        invError.message,
      );
    }

    created += inserted.length;
    console.log(`Seeded ${created}/${TOTAL_PRODUCTS} products...`);
  }

  console.log("Seeding complete.");
}

seed().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
