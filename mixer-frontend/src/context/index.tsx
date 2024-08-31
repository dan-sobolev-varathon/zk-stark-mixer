import { GearApi } from "@gear-js/api";
import { createContext } from "react";

export const gearApiContext = createContext<GearApi | undefined>(undefined);