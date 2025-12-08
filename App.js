import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SEMESTER = {
  id: 1,
  name: "Fall 2025",
  startDate: "2025-08-25",
  endDate: "2025-12-14",
};

const VENDORS = [
  { id: 1, name: "Lombardi - Mozzie's" },
  { id: 2, name: "Lombardi - Copperhead Jacks" },
  { id: 3, name: "Lombardi - Urban Hen" },
  { id: 4, name: "Lombardi - Sushi by Faith" },
  { id: 5, name: "Lombardi - Rice It Up" },
  { id: 6, name: "Lombardi - Drinks" },
  { id: 7, name: "Lombardi - Desserts" },
  { id: 8, name: "Lombardi - Pre-Packaged Meals" },
  { id: 9, name: "Lombardi - Snacks" },
  { id: 10, name: "Starbucks" },
  { id: 11, name: "Louie's" },
];

const CATEGORIES = [
  { id: "meal", label: "Meals / Entrees" },
  { id: "drink", label: "Drinks" },
  { id: "dessert", label: "Desserts" },
  { id: "snack", label: "Snacks" },
  { id: "prepackaged", label: "Pre-Packaged Meals" },
];

const ITEMS = [
  { id: 1, name: "Mozzie's Pizza", categoryId: "meal", defaultPrice: 11.5 },
  { id: 2, name: "Hamburger", categoryId: "meal", defaultPrice: 9.0 },
  { id: 3, name: "Coffee", categoryId: "drink", defaultPrice: 5.0 },
  { id: 4, name: "Soft Drink", categoryId: "drink", defaultPrice: 3.5 },
  { id: 5, name: "Bag of Chips", categoryId: "snack", defaultPrice: 4.0 },
  {
    id: 6,
    name: "Hershey's Ice Cream Pint",
    categoryId: "dessert",
    defaultPrice: 8.0,
  },
];

let NEXT_TRANSACTION_ID = 4;

// ---- helpers --------------------------------------------------------------

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function toDateOnly(dateStr) {
  return new Date(dateStr + "T00:00:00");
}

function listOpenDatesBetween(startISO, endISO, closedDaySet) {
  const out = [];
  let d = toDateOnly(startISO);
  const end = toDateOnly(endISO);
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (!closedDaySet.has(iso)) {
      out.push(iso);
    }
    d.setDate(d.setDate(d.getDate()) + 1);
  }
  return out;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

function formatDateTime(dtStr) {
  const d = new Date(dtStr);
  return d.toLocaleString();
}

function transactionTotal(tx, itemsMap) {
  let sum = 0;
  for (const line of tx.lines) {
    const price = line.price ?? itemsMap[line.itemId]?.defaultPrice ?? 0;
    sum += price * line.quantity;
  }
  return sum;
}

// keys for per-user storage
const profileKey = (username) => `LL_PROFILE_${username.toLowerCase()}`;
const transactionsKey = (username) => `LL_TX_${username.toLowerCase()}`;

// ----- Main App -----------------------------------------------------------

export default function App() {
  const [view, setView] = useState("student"); // student for student | staff for staff
  const [currentUser, setCurrentUser] = useState(null); // { username, startingBalance }
  const [transactions, setTransactions] = useState([]);
  const [closedDays, setClosedDays] = useState(["2025-11-27", "2025-11-28"]);
  const [loadingUser, setLoadingUser] = useState(false);

  // login stages: first username, then starting balance depending on if new user or not
  const [loginStage, setLoginStage] = useState("username"); // "username" | "starting"
  const [pendingUsername, setPendingUsername] = useState("");

  const itemsMap = useMemo(() => {
    const m = {};
    ITEMS.forEach((it) => (m[it.id] = it));
    return m;
  }, []);

  const vendorsMap = useMemo(() => {
    const m = {};
    VENDORS.forEach((v) => (m[v.id] = v));
    return m;
  }, []);

  const closedDaysSet = useMemo(() => new Set(closedDays), [closedDays]);

  // Save transactions whenever user or transactions change
  useEffect(() => {
    const saveTx = async () => {
      if (!currentUser) return;
      try {
        await AsyncStorage.setItem(
          transactionsKey(currentUser.username),
          JSON.stringify(transactions)
        );
      } catch (e) {
        console.log("Failed to save transactions", e);
      }
    };
    saveTx();
  }, [currentUser, transactions]);

  // metrics for current user
  const studentTx = transactions;

  const totalSpent = useMemo(
    () =>
      studentTx.reduce(
        (sum, tx) => sum + transactionTotal(tx, itemsMap),
        0
      ),
    [studentTx, itemsMap]
  );

  const remainingBalance =
    currentUser?.startingBalance != null
      ? currentUser.startingBalance - totalSpent
      : 0;

  const averageDailySpending = useMemo(() => {
    if (studentTx.length === 0) return 0;
    const firstDate = toDateOnly(SEMESTER.startDate);
    const lastDate = new Date();
    const diffMs = lastDate - firstDate;
    const diffDays = Math.max(
      1,
      Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
    );
    return totalSpent / diffDays;
  }, [studentTx, totalSpent]);

  const openFutureDays = useMemo(() => {
    return listOpenDatesBetween(todayISO(), SEMESTER.endDate, closedDaysSet);
  }, [closedDaysSet]);

  const recommendedDailySpend = useMemo(() => {
    if (remainingBalance <= 0 || openFutureDays.length === 0) return 0;
    return remainingBalance / openFutureDays.length;
  }, [remainingBalance, openFutureDays]);

  const predictedRunOutDate = useMemo(() => {
    if (averageDailySpending <= 0 || remainingBalance <= 0) return null;
    let remaining = remainingBalance;
    for (const dateISO of openFutureDays) {
      remaining -= averageDailySpending;
      if (remaining <= 0) return dateISO;
    }
    return null;
  }, [averageDailySpending, remainingBalance, openFutureDays]);

  const dailySpending = useMemo(() => {
    const map = {};
    for (const tx of studentTx) {
      const d = tx.datetime.slice(0, 10);
      map[d] = (map[d] || 0) + transactionTotal(tx, itemsMap);
    }
    return Object.entries(map)
      .sort(([d1], [d2]) => (d1 < d2 ? -1 : 1))
      .map(([date, amount]) => ({ date, amount }));
  }, [studentTx, itemsMap]);

  const categorySpending = useMemo(() => {
    const map = {};
    for (const tx of studentTx) {
      for (const line of tx.lines) {
        const item = itemsMap[line.itemId];
        if (!item) continue;
        const price = line.price ?? item.defaultPrice ?? 0;
        const cat = item.categoryId;
        map[cat] = (map[cat] || 0) + price * line.quantity;
      }
    }
    return Object.entries(map).map(([catId, amount]) => ({
      categoryId: catId,
      label: CATEGORIES.find((c) => c.id === catId)?.label || catId,
      amount,
    }));
  }, [studentTx, itemsMap]);

  // staff analytics
  const vendorTotals = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      const total = transactionTotal(tx, itemsMap);
      map[tx.vendorId] = (map[tx.vendorId] || 0) + total;
    }
    return Object.entries(map).map(([vendorId, amount]) => ({
      vendorName: vendorsMap[vendorId]?.name ?? `Vendor ${vendorId}`,
      amount,
    }));
  }, [transactions, itemsMap, vendorsMap]);

  const itemTotals = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      for (const line of tx.lines) {
        const item = itemsMap[line.itemId];
        if (!item) continue;
        const price = line.price ?? item.defaultPrice ?? 0;
        map[line.itemId] =
          (map[line.itemId] || 0) + price * line.quantity;
      }
    }
    return Object.entries(map).map(([itemId, amount]) => ({
      itemName: itemsMap[itemId]?.name ?? `Item ${itemId}`,
      amount,
    }));
  }, [transactions, itemsMap]);

  const staffCategoryTotals = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      for (const line of tx.lines) {
        const item = itemsMap[line.itemId];
        if (!item) continue;
        const price = line.price ?? item.defaultPrice ?? 0;
        const cat = item.categoryId;
        map[cat] = (map[cat] || 0) + price * line.quantity;
      }
    }
    return Object.entries(map).map(([catId, amount]) => ({
      categoryId: catId,
      label: CATEGORIES.find((c) => c.id === catId)?.label || catId,
      amount,
    }));
  }, [transactions, itemsMap]);

  const itemTrends = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      const date = tx.datetime.slice(0, 10);
      for (const line of tx.lines) {
        const key = `${line.itemId}-${date}`;
        const item = itemsMap[line.itemId];
        if (!item) continue;
        const price = line.price ?? item.defaultPrice ?? 0;
        map[key] = (map[key] || 0) + price * line.quantity;
      }
    }
    return Object.entries(map)
      .map(([key, amount]) => {
        const [itemId, date] = key.split("-");
        return {
          itemName: itemsMap[itemId]?.name ?? `Item ${itemId}`,
          date,
          amount,
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [transactions, itemsMap]);

  // ----- login flow --------------------------------------------------------

  async function handleUsernameSubmit(usernameInput) {
    const username = usernameInput.trim().toLowerCase();
    if (!username) return;
    setLoadingUser(true);

    try {
      const pKey = profileKey(username);
      const tKey = transactionsKey(username);

      const existingProfileJson = await AsyncStorage.getItem(pKey);

      if (existingProfileJson) {
        const profile = JSON.parse(existingProfileJson);
        const txJson = await AsyncStorage.getItem(tKey);
        const txs = txJson ? JSON.parse(txJson) : [];

        setCurrentUser(profile);
        setTransactions(txs);
        NEXT_TRANSACTION_ID =
          txs.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
        setLoginStage("username");
      } else {
        setPendingUsername(username);
        setLoginStage("starting");
      }
    } catch (e) {
      console.log("Error during username submit", e);
    } finally {
      setLoadingUser(false);
    }
  }

  async function handleStartingBalanceSubmit(startingBalanceInput) {
    const starting = parseFloat(startingBalanceInput);
    if (isNaN(starting) || starting <= 0 || !pendingUsername) return;

    setLoadingUser(true);
    try {
      const username = pendingUsername;
      const pKey = profileKey(username);
      const tKey = transactionsKey(username);

      const profile = { username, startingBalance: starting };
      await AsyncStorage.setItem(pKey, JSON.stringify(profile));
      await AsyncStorage.setItem(tKey, JSON.stringify([]));

      setCurrentUser(profile);
      setTransactions([]);
      NEXT_TRANSACTION_ID = 1;
      setLoginStage("username");
      setPendingUsername("");
    } catch (e) {
      console.log("Error saving starting balance", e);
    } finally {
      setLoadingUser(false);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setTransactions([]);
    setView("student");
    setLoginStage("username");
    setPendingUsername("");
  }

  // handlers for transactions / closed days

  function handleAddTransaction(form) {
    if (!currentUser) return;
    const newTx = {
      id: NEXT_TRANSACTION_ID++,
      vendorId: Number(form.vendorId),
      datetime: `${form.date}T${form.time || "12:00"}`,
      lines: [
        {
          itemId: Number(form.itemId),
          quantity: Number(form.quantity),
          price: Number(form.price),
        },
      ],
    };
    setTransactions((prev) => [...prev, newTx]);
  }

  function handleAddClosedDay(dateISO) {
    if (!dateISO) return;
    setClosedDays((prev) =>
      prev.includes(dateISO) ? prev : [...prev, dateISO].sort()
    );
  }

  function handleRemoveClosedDay(dateISO) {
    setClosedDays((prev) => prev.filter((d) => d !== dateISO));
  }

  // ---- RENDER -------------------------------------------------------------

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loginContainer}>
          {loginStage === "username" ? (
            <UsernameScreen
              onNext={handleUsernameSubmit}
              loading={loadingUser}
            />
          ) : (
            <StartingBalanceScreen
              username={pendingUsername}
              onNext={handleStartingBalanceSubmit}
              loading={loadingUser}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Lombardi Logger</Text>
          <Text style={styles.subtitle}>Dining hall money tracker</Text>
          <Text style={[styles.muted, styles.smallText, { marginTop: 4 }]}>
            Logged in as{" "}
            <Text style={styles.bold}>{currentUser.username}</Text>
          </Text>
          <View style={styles.toggleRow}>
            <ToggleButton
              active={view === "student"}
              label="Student View"
              onPress={() => setView("student")}
            />
            <ToggleButton
              active={view === "staff"}
              label="Staff View"
              onPress={() => setView("staff")}
            />
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        {view === "student" ? (
          <StudentView
            studentName={currentUser.username}
            semester={SEMESTER}
            startingBalance={currentUser.startingBalance}
            totalSpent={totalSpent}
            remainingBalance={remainingBalance}
            averageDailySpending={averageDailySpending}
            recommendedDailySpend={recommendedDailySpend}
            predictedRunOutDate={predictedRunOutDate}
            dailySpending={dailySpending}
            categorySpending={categorySpending}
            transactions={studentTx}
            itemsMap={itemsMap}
            vendorsMap={vendorsMap}
            onAddTransaction={handleAddTransaction}
          />
        ) : (
          <StaffView
            semester={SEMESTER}
            vendorTotals={vendorTotals}
            itemTotals={itemTotals}
            categoryTotals={staffCategoryTotals}
            itemTrends={itemTrends}
            closedDays={closedDays}
            onAddClosedDay={handleAddClosedDay}
            onRemoveClosedDay={handleRemoveClosedDay}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ----- UI components -------------------------------------------------------

function ToggleButton({ active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleButton,
        active && styles.toggleButtonActive,
      ]}
    >
      <Text
        style={[
          styles.toggleButtonText,
          active && styles.toggleButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryTile({ label, value, highlight }) {
  return (
    <View
      style={[
        styles.summaryTile,
        highlight && styles.summaryTileHighlight,
      ]}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ----- Login screens -------------------------------------------------------

function UsernameScreen({ onNext, loading }) {
  const [username, setUsername] = useState("");

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lombardi Logger</Text>
      <Text style={[styles.muted, { marginBottom: 10 }]}>
        Enter your username to continue.
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput
          style={[styles.input, { color: "#ffffff" }]}
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. austin23"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={() => onNext(username)}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Checking..." : "Continue"}
        </Text>
      </Pressable>
    </View>
  );
}

function StartingBalanceScreen({ username, onNext, loading }) {
  const [startingBalance, setStartingBalance] = useState("");

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Welcome, {username}</Text>
      <Text style={[styles.muted, { marginBottom: 10 }]}>
        It looks like this is your first time using Lombardi Logger.
        Enter your starting dining dollar balance for this semester.
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Starting Balance</Text>
        <TextInput
          style={[styles.input, { color: "#ffffff" }]}
          value={startingBalance}
          onChangeText={setStartingBalance}
          placeholder="e.g. 2100"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
          autoCorrect={false}
        />
      </View>

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={() => onNext(startingBalance)}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Saving..." : "Continue to App"}
        </Text>
      </Pressable>
    </View>
  );
}

// ----- Student View --------------------------------------------------------

function StudentView({
  studentName,
  semester,
  startingBalance,
  totalSpent,
  remainingBalance,
  averageDailySpending,
  recommendedDailySpend,
  predictedRunOutDate,
  dailySpending,
  categorySpending,
  transactions,
  itemsMap,
  vendorsMap,
  onAddTransaction,
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome, {studentName}</Text>
        <Text style={styles.muted}>
          Semester: <Text style={styles.bold}>{semester.name}</Text>
        </Text>
        <View style={styles.summaryGrid}>
          <SummaryTile
            label="Starting Balance"
            value={`$${startingBalance.toFixed(2)}`}
          />
          <SummaryTile
            label="Total Spent"
            value={`$${totalSpent.toFixed(2)}`}
          />
          <SummaryTile
            label="Remaining Balance"
            value={`$${remainingBalance.toFixed(2)}`}
            highlight
          />
          <SummaryTile
            label="Average Spent / Day"
            value={`$${averageDailySpending.toFixed(2)}`}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Predictions & Recommendations</Text>
        <View style={styles.summaryGrid}>
          <SummaryTile
            label="Recommended Daily Spend"
            value={`$${recommendedDailySpend.toFixed(2)}`}
          />
          <SummaryTile
            label="Predicted Run-Out Date"
            value={
              predictedRunOutDate
                ? formatDate(predictedRunOutDate)
                : "Not expected this semester"
            }
          />
        </View>
        <Text style={[styles.muted, styles.smallText, { marginTop: 6 }]}>
          Closed days are excluded from these predictions.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Purchase</Text>
        <AddTransactionForm
          onAdd={onAddTransaction}
          items={ITEMS}
          vendors={VENDORS}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending Visualizations</Text>
        <View style={styles.chartRow}>
          <DailySpendingChart data={dailySpending} />
          <CategorySpendingChart data={categorySpending} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Transaction History</Text>
        <TransactionsList
          transactions={transactions}
          itemsMap={itemsMap}
          vendorsMap={vendorsMap}
        />
      </View>
    </ScrollView>
  );
}

function AddTransactionForm({ onAdd, items, vendors }) {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("12:00");
  const [vendorId, setVendorId] = useState(String(vendors[0]?.id ?? ""));
  const [itemId, setItemId] = useState(String(items[0]?.id ?? ""));
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(
    String(items[0]?.defaultPrice ?? "0")
  );

  function onSubmit() {
    onAdd({
      date,
      time,
      vendorId,
      itemId,
      quantity,
      price,
    });
  }

  function handleItemChange(value) {
    setItemId(value);
    const item = items.find((it) => String(it.id) === value);
    if (item) setPrice(String(item.defaultPrice));
  }

  return (
    <View style={styles.formGrid}>
      <FormField label="Date" value={date} onChangeText={setDate} />
      <FormField label="Time" value={time} onChangeText={setTime} />

      <FormField
        label="Vendor (id)"
        value={vendorId}
        onChangeText={setVendorId}
        helper="Use: 1 = Mozzie's, 2 = Copperhead Jack's, etc."
      />

      <FormField
        label="Item (id)"
        value={itemId}
        onChangeText={handleItemChange}
        helper="Use: 1–6 from seed items"
      />

      <FormField
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />

      <FormField
        label="Price per item"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <Pressable style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>Save Transaction</Text>
      </Pressable>
    </View>
  );
}

function FormField({ label, value, onChangeText, helper, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
      {helper ? (
        <Text style={[styles.muted, styles.smallText]}>{helper}</Text>
      ) : null}
    </View>
  );
}

function TransactionsList({ transactions, itemsMap, vendorsMap }) {
  if (transactions.length === 0) {
    return (
      <Text style={[styles.muted, { marginTop: 4 }]}>
        No transactions yet.
      </Text>
    );
  }

  const sorted = transactions
    .slice()
    .sort((a, b) => (a.datetime < b.datetime ? -1 : 1));

  return (
    <View style={{ marginTop: 4 }}>
      {sorted.map((item) => {
        const total = transactionTotal(item, itemsMap);
        const firstItem = itemsMap[item.lines[0]?.itemId];
        const categoryLabel = firstItem
          ? CATEGORIES.find((c) => c.id === firstItem.categoryId)?.label ??
            firstItem.categoryId
          : "-";

        return (
          <View style={styles.txRow} key={item.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txTitle}>
                {vendorsMap[item.vendorId]?.name ?? "Vendor"}
              </Text>
              <Text style={[styles.muted, styles.smallText]}>
                {formatDateTime(item.datetime)}
              </Text>
              <Text style={[styles.muted, styles.smallText]}>
                Category: {categoryLabel}
              </Text>
              {item.lines.map((line, idx) => {
                const it = itemsMap[line.itemId];
                return (
                  <Text
                    key={idx}
                    style={[styles.muted, styles.smallText]}
                  >
                    {it?.name} × {line.quantity} @ $
                    {(line.price ?? it?.defaultPrice ?? 0).toFixed(2)}
                  </Text>
                );
              })}
            </View>
            <Text style={styles.txAmount}>${total.toFixed(2)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ---- simple bar "charts" --------------------------------------------------

function DailySpendingChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.chart}>
        <Text style={styles.chartTitle}>Daily Spending</Text>
        <Text style={styles.muted}>No data yet.</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.amount));

  return (
    <View style={styles.chart}>
      <Text style={styles.chartTitle}>Daily Spending</Text>
      {data.map((d) => (
        <View style={styles.barRow} key={d.date}>
          <Text style={[styles.muted, styles.smallText]}>
            {formatDate(d.date)}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${(d.amount / max) * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.muted, styles.smallText]}>
            ${d.amount.toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CategorySpendingChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.chart}>
        <Text style={styles.chartTitle}>By Category</Text>
        <Text style={styles.muted}>No data yet.</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.amount));

  return (
    <View style={styles.chart}>
      <Text style={styles.chartTitle}>By Category</Text>
      {data.map((d) => (
        <View style={styles.barRow} key={d.categoryId}>
          <Text style={[styles.muted, styles.smallText]}>{d.label}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${(d.amount / max) * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.muted, styles.smallText]}>
            ${d.amount.toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ----- Staff view ----------------------------------------------------------

function StaffView({
  semester,
  vendorTotals,
  itemTotals,
  categoryTotals,
  itemTrends,
  closedDays,
  onAddClosedDay,
  onRemoveClosedDay,
}) {
  const [closedInput, setClosedInput] = useState("");

  function addClosed() {
    onAddClosedDay(closedInput);
    setClosedInput("");
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Staff Dashboard</Text>
        <Text style={styles.muted}>
          Semester: <Text style={styles.bold}>{semester.name}</Text>
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Vendor</Text>
        {vendorTotals.length === 0 ? (
          <Text style={styles.muted}>No data.</Text>
        ) : (
          vendorTotals.map((v, idx) => (
            <View style={styles.simpleRow} key={idx}>
              <Text style={styles.simpleLabel}>{v.vendorName}</Text>
              <Text style={styles.simpleValue}>
                ${v.amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Item</Text>
        {itemTotals.length === 0 ? (
          <Text style={styles.muted}>No data.</Text>
        ) : (
          itemTotals.map((i, idx) => (
            <View style={styles.simpleRow} key={idx}>
              <Text style={styles.simpleLabel}>{i.itemName}</Text>
              <Text style={styles.simpleValue}>
                ${i.amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Category</Text>
        {categoryTotals.length === 0 ? (
          <Text style={styles.muted}>No data.</Text>
        ) : (
          categoryTotals.map((c, idx) => (
            <View style={styles.simpleRow} key={idx}>
              <Text style={styles.simpleLabel}>{c.label}</Text>
              <Text style={styles.simpleValue}>
                ${c.amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Item Popularity Over Time</Text>
        {itemTrends.length === 0 ? (
          <Text style={styles.muted}>No data.</Text>
        ) : (
          itemTrends.map((t, idx) => (
            <View style={styles.simpleRow} key={idx}>
              <Text style={styles.simpleLabel}>
                {formatDate(t.date)} — {t.itemName}
              </Text>
              <Text style={styles.simpleValue}>
                ${t.amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Closed Days Management</Text>
        <Text style={[styles.muted, styles.smallText, { marginBottom: 6 }]}>
          Closed days are excluded from student predictions.
        </Text>

        <View style={styles.formRow}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Closed date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={closedInput}
              onChangeText={setClosedInput}
              placeholder="2025-11-27"
            />
          </View>
          <Pressable style={styles.button} onPress={addClosed}>
            <Text style={styles.buttonText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {closedDays.length === 0 ? (
            <Text style={styles.muted}>No closed days.</Text>
          ) : (
            closedDays.map((d) => (
              <Pressable
                key={d}
                onPress={() => onRemoveClosedDay(d)}
                style={styles.chip}
              >
                <Text style={styles.chipText}>
                  {formatDate(d)} ✕
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ----- styles --------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  loginContainer: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f9fafb",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
  },
  toggleRow: {
    flexDirection: "row",
    marginTop: 10,
    backgroundColor: "#111827",
    borderRadius: 999,
    padding: 4,
    alignItems: "center",
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  toggleButtonActive: {
    backgroundColor: "#f97316",
  },
  toggleButtonText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  toggleButtonTextActive: {
    color: "#111827",
    fontWeight: "600",
  },
  logoutButton: {
    marginLeft: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f97316",
  },
  logoutText: {
    fontSize: 11,
    color: "#f97316",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    gap: 10,
  },
  card: {
    backgroundColor: "#0b1120",
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f9fafb",
    marginBottom: 6,
  },
  muted: {
    color: "#9ca3af",
  },
  smallText: {
    fontSize: 11,
  },
  bold: {
    fontWeight: "600",
    color: "#e5e7eb",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  summaryTile: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    minWidth: "47%",
  },
  summaryTileHighlight: {
    borderColor: "#f97316",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#9ca3af",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f9fafb",
    marginTop: 2,
  },
  field: {
    marginBottom: 10,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f9fafb",
    backgroundColor: "#020617",
    fontSize: 13,
  },
  formGrid: {
    marginTop: 8,
  },
  button: {
    marginTop: 10,
    backgroundColor: "#f97316",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: "stretch",
    alignItems: "center",
  },
  buttonText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 14,
  },
  chartRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  chart: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f9fafb",
    marginBottom: 4,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#111827",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#f97316",
  },
  txRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  txTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e5e7eb",
  },
  txAmount: {
    marginLeft: 8,
    fontWeight: "600",
    color: "#f9fafb",
  },
  simpleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  simpleLabel: {
    color: "#e5e7eb",
    fontSize: 13,
  },
  simpleValue: {
    color: "#f9fafb",
    fontWeight: "600",
    fontSize: 13,
  },
  formRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    marginTop: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f97316",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#0b1120",
  },
  chipText: {
    color: "#f97316",
    fontSize: 11,
  },
});
