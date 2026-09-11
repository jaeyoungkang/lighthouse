#!/usr/bin/env node

import { runReview } from "./lighthouse-adapter.mjs";

await runReview({ check: true, validateOnly: true });
console.log("Architecture Fitness v0.9.1 consumer contract is valid");
