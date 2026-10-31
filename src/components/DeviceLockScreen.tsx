import React from "react";
import { User, AppConfig } from "../types";

interface DeviceLockScreenProps {
  user: User;
  appConfig?: AppConfig;
  onLogout: () => void;
  onUnlockSuccess?: () => void;
}

export default function DeviceLockScreen(_props: DeviceLockScreenProps) {
  return null;
}
