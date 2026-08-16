import { getSupabaseAdmin, createUserClient } from "../config/supabase";

async function createTestUser(
  email: string,
  password: string,
  role: "SELLER" | "CUSTOMER",
) {
  const admin = getSupabaseAdmin();
  let userId: string;

  const { data: userData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError) {
    if (!createError.message.includes("already been registered")) {
      console.error(`Failed to create ${email}:`, createError.message);
      return;
    }
    // User already exists from a previous run — sign in to recover their id instead.
    const anonClient = createUserClient("");
    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({
        email,
        password,
      });
    if (signInError || !signInData.user) {
      console.error(
        `User exists but sign-in failed for ${email}:`,
        signInError?.message,
      );
      return;
    }
    userId = signInData.user.id;
  } else {
    userId = userData.user.id;
  }

  // Upsert profile so re-running this script is always safe.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      role,
      full_name: role === "SELLER" ? "Test Seller" : "Test Customer",
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error(
      `Failed to upsert profile for ${email}:`,
      profileError.message,
    );
    return;
  }

  const anonClient = createUserClient("");
  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {
    console.error(`Failed to sign in ${email}:`, signInError.message);
    return;
  }

  console.log(`\n${role} — ${email}`);
  console.log(`user_id: ${userId}`);
  console.log(`access_token: ${signInData.session?.access_token}`);
}

async function main() {
  await createTestUser("seller1@test.com", "TestPass123!", "SELLER");
  await createTestUser("seller2@test.com", "TestPass123!", "SELLER");
  await createTestUser("customer1@test.com", "TestPass123!", "CUSTOMER");
}

main();
