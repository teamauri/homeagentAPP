"use client";

import { useState } from "react";
import { AppShell, TabKey } from "@/components/AppShell";
import { TodayView } from "@/components/TodayView";
import { CalendarView } from "@/components/CalendarView";
import { JourneysView } from "@/components/JourneysView";
import { MomentsView } from "@/components/MomentsView";
import { FamilyView } from "@/components/FamilyView";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("today");

  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {tab === "today" && <TodayView />}
      {tab === "calendar" && <CalendarView />}
      {tab === "journeys" && <JourneysView />}
      {tab === "moments" && <MomentsView />}
      {tab === "family" && <FamilyView />}
    </AppShell>
  );
}
