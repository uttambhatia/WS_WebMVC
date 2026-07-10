useEffect(() => {
  onExecutionModeChange("run");
  // Only clear schedule fields when not in view or rerun mode to preserve loaded values
  if (mode !== "view" && mode !== "rerun") {
    setScheduleRunAt("");
    setScheduleTimezoneQuery("");
    setSelectedTimezone(null);
    setScheduleRecurring(false);
    setScheduleFrequencyQuery("");
    setSelectedFrequency(null);
    setScheduleError("");
    setScheduleMessage("");
  }
}, [mode, execution?.testId, onExecutionModeChange]);


---------------new-----------
  useEffect(() => {
  const openedFromScheduleListing =
    typeof execution?.testId === "string" && execution.testId.startsWith("schedule-");

  onExecutionModeChange(openedFromScheduleListing ? "schedule" : "run");

  // Only clear schedule fields when not in view or rerun mode to preserve loaded values
  if (mode !== "view" && mode !== "rerun") {
    setScheduleRunAt("");
    setScheduleTimezoneQuery("");
    setSelectedTimezone(null);
    setScheduleRecurring(false);
    setScheduleFrequencyQuery("");
    setSelectedFrequency(null);
    setScheduleError("");
    setScheduleMessage("");
  }
}, [mode, execution?.testId, onExecutionModeChange]);
