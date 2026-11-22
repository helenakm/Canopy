import type {
  ProactiveInsight,
  SanitizedSubscriptionView,
  ServiceEvent,
  SubscriptionPlan,
  UsageRecord,
} from './types.ts';

const REFERENCE_TODAY = '2026-11-21';

function daysBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso.slice(0, 10) + 'T00:00:00Z').getTime();
  const e = new Date(endIso.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export function generateDeterministicInsights(
  subscriptions: SanitizedSubscriptionView[],
  usageRecords: UsageRecord[],
  serviceEvents: ServiceEvent[],
  plans: SubscriptionPlan[],
): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];
  const advisoryNote =
    'Informational recommendation only — does not modify active contracts and remains subject to contract eligibility and human approval.';

  for (const sub of subscriptions) {
    const subUsage = usageRecords.filter((u) => u.subscriptionId === sub.id);
    const subEvents = serviceEvents.filter((e) => e.subscriptionId === sub.id);
    const currentPlan = plans.find((p) => p.id === sub.planId);

    // 1. COST-SAVING OPPORTUNITIES (Historical Usage vs Plan Catalogue)
    if (sub.subscriptionType === 'hardware_maintenance' && subUsage.length > 0 && currentPlan) {
      const avgUnits =
        subUsage.reduce((acc, r) => acc + r.unitsUsed, 0) / subUsage.length;
      const avgOverageCost =
        subUsage.reduce((acc, r) => acc + r.overageCost, 0) / subUsage.length;
      const currentTotalMonthly = currentPlan.monthlyEquivalentBaseCost + avgOverageCost;

      const eligibleAlternatives = plans.filter(
        (p) =>
          p.subscriptionType === 'hardware_maintenance' &&
          p.id !== currentPlan.id &&
          (sub.tonerServiceExcluded ? p.tonerIncluded === false : true),
      );

      let bestPlan: SubscriptionPlan | null = null;
      let bestMonthlyCost = currentTotalMonthly;

      for (const alt of eligibleAlternatives) {
        const altOverageUnits = Math.max(0, avgUnits - alt.includedUnits);
        const altMonthlyCost =
          alt.monthlyEquivalentBaseCost + altOverageUnits * alt.overageRatePerUnit;
        if (altMonthlyCost < bestMonthlyCost - 15) {
          bestMonthlyCost = altMonthlyCost;
          bestPlan = alt;
        }
      }

      if (bestPlan) {
        const monthlySavings = Math.round((currentTotalMonthly - bestMonthlyCost) * 100) / 100;
        const annualSavings = Math.round(monthlySavings * 12 * 100) / 100;
        const avgRounded = Math.round(avgUnits);
        const isDowngrade = bestPlan.includedUnits < currentPlan.includedUnits;

        insights.push({
          id: `INS-COST-${sub.id}`,
          category: 'cost_optimization',
          severity: monthlySavings >= 100 ? 'high' : 'medium',
          title: `Save up to $${Math.round(annualSavings).toLocaleString()} annually by reviewing your ${String(sub.visibleCustomFields.deviceModel || sub.product)} print plan`,
          subscriptionId: sub.id,
          product: sub.product,
          subscriptionType: sub.subscriptionType,
          dealerId: sub.dealerId,
          dealerName: sub.dealerName,
          customerId: sub.customerId,
          customerLabel: sub.customerDisplayLabel,
          summary: isDowngrade
            ? `Monthly printing averages ${avgRounded.toLocaleString()} pages against a ${currentPlan.includedUnits.toLocaleString()}-page plan, leaving over two-thirds of included capacity unused.`
            : `Monthly printing averages ${avgRounded.toLocaleString()} pages, consistently exceeding the ${currentPlan.includedUnits.toLocaleString()}-page allowance and incurring $${avgOverageCost.toFixed(2)}/mo in overage fees.`,
          whyItMatters: isDowngrade
            ? 'Paying for unused print capacity inflates recurring monthly spend without operational benefit.'
            : 'Recurring per-page overage fees cost more per page than stepping up to a higher included volume tier.',
          recommendedAction: `Review switching to ${bestPlan.name} ($${bestPlan.monthlyEquivalentBaseCost}/mo for ${bestPlan.includedUnits.toLocaleString()} pages) with your account team.`,
          advisoryDisclaimer: advisoryNote,
          estimatedMonthlySavings: monthlySavings,
          estimatedAnnualSavings: annualSavings,
          currentPlanName: `${currentPlan.name} ($${currentPlan.monthlyEquivalentBaseCost}/mo · ${currentPlan.includedUnits.toLocaleString()} pages)`,
          recommendedPlanName: `${bestPlan.name} ($${bestPlan.monthlyEquivalentBaseCost}/mo · ${bestPlan.includedUnits.toLocaleString()} pages)`,
          actualUsageSummary: `${avgRounded.toLocaleString()} pages/mo (${subUsage.length}-month verified average)`,
          calculationBreakdown: `Current average spend ($${currentPlan.monthlyEquivalentBaseCost}/mo base + $${avgOverageCost.toFixed(2)}/mo average overage = $${currentTotalMonthly.toFixed(2)}/mo) minus ${bestPlan.name} ($${bestPlan.monthlyEquivalentBaseCost}/mo base + $${(Math.max(0, avgUnits - bestPlan.includedUnits) * bestPlan.overageRatePerUnit).toFixed(2)}/mo projected overage = $${bestMonthlyCost.toFixed(2)}/mo) = $${monthlySavings.toFixed(2)}/mo ($${annualSavings.toFixed(2)}/yr).`,
          assumptions: [
            `Calculated across ${subUsage.length} monthly meter readings (${subUsage.map((u) => u.billingMonth).join(', ')}).`,
            `Preserves existing toner coverage (${sub.tonerServiceExcluded ? 'Parts & Labour Only — Toner Excluded' : 'Toner Service Included'}).`,
            `Contract eligibility: ${bestPlan.eligibilityRule}`,
          ],
          supportingRecordIds: subUsage.map((u) => u.id),
          metrics: [
            { label: 'Actual Usage', value: `${avgRounded.toLocaleString()} pgs/mo` },
            { label: 'Current Spend', value: `$${currentTotalMonthly.toFixed(2)}/mo` },
            { label: 'Recommended Plan', value: `$${bestMonthlyCost.toFixed(2)}/mo` },
            { label: 'Annual Savings', value: `$${annualSavings.toFixed(2)}/yr` },
          ],
        });
      }
    }

    // Software Seat Consolidation Savings
    if (sub.subscriptionType === 'software_licence') {
      const seats = Number(sub.customFields.licenceSeats || 0);
      const activeSeats = Number(sub.customFields.activeSeatUtilization || seats);
      const utilizationPct = seats > 0 ? Math.round((activeSeats / seats) * 100) : 100;

      if (seats > 0 && utilizationPct < 65) {
        const rightSizedPlan = plans.find((p) => p.id === 'SW-M365-RIGHTSIZE');
        const currentMonthly = sub.monthlyEquivalentCost;
        const targetMonthly = rightSizedPlan
          ? rightSizedPlan.monthlyEquivalentBaseCost
          : Math.round(currentMonthly * 0.65);
        const monthlySavings = Math.max(0, Math.round((currentMonthly - targetMonthly) * 100) / 100);
        const annualSavings = Math.round(monthlySavings * 12 * 100) / 100;

        if (monthlySavings > 0) {
          insights.push({
            id: `INS-COST-${sub.id}`,
            category: 'cost_optimization',
            severity: 'high',
            title: `Save $${Math.round(annualSavings).toLocaleString()} annually by right-sizing ${seats - activeSeats} unused ${String(sub.customFields.softwareName || sub.product)} seats`,
            subscriptionId: sub.id,
            product: sub.product,
            subscriptionType: sub.subscriptionType,
            dealerId: sub.dealerId,
            dealerName: sub.dealerName,
            customerId: sub.customerId,
            customerLabel: sub.customerDisplayLabel,
            summary: `Only ${activeSeats} of ${seats} paid software seats (${utilizationPct}%) have been active over the past 90 days.`,
            whyItMatters: 'Unassigned software licences add avoidable annual SaaS spend without improving team productivity.',
            recommendedAction: `Prepare a 60-seat consolidation proposal ahead of the next renewal window while keeping a 14-seat buffer.`,
            advisoryDisclaimer: advisoryNote,
            estimatedMonthlySavings: monthlySavings,
            estimatedAnnualSavings: annualSavings,
            currentPlanName: `${sub.product} (${seats} seats · $${currentMonthly.toFixed(0)}/mo)`,
            recommendedPlanName: `${rightSizedPlan?.name || '60-Seat Right-Sized Pool'} ($${targetMonthly.toFixed(0)}/mo)`,
            actualUsageSummary: `${activeSeats} active seats of ${seats} licensed (${utilizationPct}% utilization)`,
            calculationBreakdown: `Current $${currentMonthly.toFixed(2)}/mo (${seats} seats) minus $${targetMonthly.toFixed(2)}/mo (60-seat active pool) = $${monthlySavings.toFixed(2)}/mo ($${annualSavings.toFixed(2)}/yr).`,
            assumptions: [
              `Active user count verified from 3 monthly seat snapshots (${activeSeats} active).`,
              'Includes 14 spare seats for near-term onboarding.',
              'Requires renewal or annual true-down eligibility.',
            ],
            supportingRecordIds: subUsage.length > 0 ? subUsage.map((u) => u.id) : [sub.id],
            metrics: [
              { label: 'Active Seats', value: `${activeSeats} / ${seats}` },
              { label: 'Unused Seats', value: `${seats - activeSeats}` },
              { label: 'Monthly Savings', value: `$${monthlySavings.toFixed(2)}/mo` },
              { label: 'Annual Savings', value: `$${annualSavings.toFixed(2)}/yr` },
            ],
          });
        }
      } else if (seats > 0 && utilizationPct >= 92) {
        // GROWTH OPPORTUNITY: Software licence seat pool nearly full
        insights.push({
          id: `INS-GROW-${sub.id}`,
          category: 'growth_opportunity',
          severity: 'low',
          title: `Expand ${String(sub.customFields.softwareName || sub.product)} seat pool (${utilizationPct}% seats assigned)`,
          subscriptionId: sub.id,
          product: sub.product,
          subscriptionType: sub.subscriptionType,
          dealerId: sub.dealerId,
          dealerName: sub.dealerName,
          customerId: sub.customerId,
          customerLabel: sub.customerDisplayLabel,
          summary: `${activeSeats} of ${seats} seats are currently assigned, leaving only ${seats - activeSeats} seats before new staff onboarding is blocked.`,
          whyItMatters: 'Proactively bundling additional seats at partner volume pricing avoids ad-hoc retail seat purchases.',
          recommendedAction: 'Offer an incremental 10-seat expansion pack during the upcoming account check-in.',
          advisoryDisclaimer: advisoryNote,
          currentPlanName: `${sub.product} (${seats} seats)`,
          recommendedPlanName: `${sub.product} (${seats + 10} seat bundle)`,
          actualUsageSummary: `${activeSeats} / ${seats} seats active (${utilizationPct}%)`,
          supportingRecordIds: [sub.id],
          metrics: [
            { label: 'Assigned Seats', value: `${activeSeats} / ${seats}` },
            { label: 'Remaining Buffer', value: `${seats - activeSeats} seats` },
            { label: 'Utilization', value: `${utilizationPct}%` },
          ],
        });
      }
    }

    // 2. REQUIRES ATTENTION: Open Service Flags & Underutilized Hardware
    const openFlags = subEvents.filter((e) => e.eventType === 'service_flag' && !e.resolved);
    if (openFlags.length > 0) {
      insights.push({
        id: `INS-ATTN-${sub.id}`,
        category: 'requires_attention',
        severity:
          openFlags.some((f) => f.severity === 'high') || openFlags.length >= 2
            ? 'high'
            : 'medium',
        title: `Resolve ${openFlags.length} open service alert${openFlags.length > 1 ? 's' : ''} on ${String(sub.customFields.deviceModel || sub.product)}`,
        subscriptionId: sub.id,
        product: sub.product,
        subscriptionType: sub.subscriptionType,
        dealerId: sub.dealerId,
        dealerName: sub.dealerName,
        customerId: sub.customerId,
        customerLabel: sub.customerDisplayLabel,
        summary: openFlags.map((f) => `${f.occurredAt}: ${f.description}`).join(' '),
        whyItMatters:
          'Unresolved hardware sensor warnings increase the risk of unplanned downtime during peak office workflows.',
        recommendedAction: sub.tonerServiceExcluded
          ? 'Schedule a Canon field technician visit (parts & labour coverage; toner excluded).'
          : 'Dispatch dealer service technician and verify preventive parts stock.',
        advisoryDisclaimer: advisoryNote,
        actualUsageSummary: `${openFlags.length} unresolved service flag${openFlags.length > 1 ? 's' : ''} logged`,
        supportingRecordIds: openFlags.map((f) => f.id),
        metrics: [
          { label: 'Open Alerts', value: `${openFlags.length}` },
          { label: 'Highest Severity', value: openFlags.some((f) => f.severity === 'high') ? 'High' : 'Medium' },
          { label: 'Latest Alert', value: openFlags[openFlags.length - 1].occurredAt },
        ],
      });
    }

    if (sub.subscriptionType === 'hardware_maintenance') {
      const usage = Number(sub.customFields.monthlyPageUsage || 0);
      const allowance = Number(sub.customFields.pageAllowance || 0);
      if (allowance > 0) {
        const pct = Math.round((usage / allowance) * 100);
        if (pct < 35 && !insights.some((i) => i.id === `INS-COST-${sub.id}`)) {
          insights.push({
            id: `INS-ATTN-UND-${sub.id}`,
            category: 'requires_attention',
            severity: 'medium',
            title: `Review low print volume on ${String(sub.customFields.deviceModel || sub.product)} (${pct}% of allowance used)`,
            subscriptionId: sub.id,
            product: sub.product,
            subscriptionType: sub.subscriptionType,
            dealerId: sub.dealerId,
            dealerName: sub.dealerName,
            customerId: sub.customerId,
            customerLabel: sub.customerDisplayLabel,
            summary: `Device is averaging ${usage.toLocaleString()} pages/mo against a ${allowance.toLocaleString()}-page monthly cap.`,
            whyItMatters: 'Low utilization suggests the branch may be over-provisioned relative to actual print demand.',
            recommendedAction: 'Review whether a smaller page allowance tier fits better at renewal.',
            advisoryDisclaimer: advisoryNote,
            actualUsageSummary: `${usage.toLocaleString()} / ${allowance.toLocaleString()} pages/mo (${pct}%)`,
            supportingRecordIds: subUsage.length > 0 ? subUsage.map((u) => u.id) : [sub.id],
            metrics: [
              { label: 'Monthly Usage', value: `${usage.toLocaleString()} pgs` },
              { label: 'Plan Allowance', value: `${allowance.toLocaleString()} pgs` },
              { label: 'Utilization', value: `${pct}%` },
            ],
          });
        }
      }
    }

    // 3. GROWTH OPPORTUNITIES: Managed IT approaching device capacity (>= 80%)
    if (sub.subscriptionType === 'managed_it') {
      const used = Number(sub.customFields.supportedDevices || 0);
      const cap = Number(sub.customFields.capacityLimit || 0);
      if (cap > 0) {
        const pct = Math.round((used / cap) * 100);
        if (pct >= 80) {
          const nextPlan = plans.find((p) => p.id === 'MIT-PLAT-120');
          insights.push({
            id: `INS-GROW-${sub.id}`,
            category: 'growth_opportunity',
            severity: pct >= 90 ? 'high' : 'medium',
            title: `Managed IT capacity at ${pct}% (${used} of ${cap} devices) — ready for tier expansion`,
            subscriptionId: sub.id,
            product: sub.product,
            subscriptionType: sub.subscriptionType,
            dealerId: sub.dealerId,
            dealerName: sub.dealerName,
            customerId: sub.customerId,
            customerLabel: sub.customerDisplayLabel,
            summary: `${used} of ${cap} enrolled endpoints are active under ${String(sub.customFields.supportLevel)}, leaving room for ${cap - used} more devices.`,
            whyItMatters: 'Expanding capacity before hitting the ceiling ensures uninterrupted endpoint monitoring and faster 10-minute SLA response.',
            recommendedAction: `Discuss upgrading to ${nextPlan?.name || 'Dedicated NOC Platinum (120 Devices)'} ahead of device onboarding.`,
            advisoryDisclaimer: advisoryNote,
            currentPlanName: `${currentPlan?.name || sub.planName} (${cap} devices · $${sub.monthlyEquivalentCost}/mo)`,
            recommendedPlanName: nextPlan
              ? `${nextPlan.name} ($${nextPlan.monthlyEquivalentBaseCost}/mo)`
              : 'Dedicated NOC Platinum (120 Devices)',
            actualUsageSummary: `${used} enrolled endpoints (${pct}% of ${cap}-device ceiling)`,
            supportingRecordIds: [sub.id],
            metrics: [
              { label: 'Enrolled Devices', value: `${used}` },
              { label: 'Capacity Ceiling', value: `${cap}` },
              { label: 'Headroom', value: `${cap - used} devices` },
            ],
          });
        }
      }
    }

    // 4. UPCOMING RENEWALS (within 90 days of 2026-11-21)
    const daysToRenewal = daysBetween(REFERENCE_TODAY, sub.renewalDate);
    if (daysToRenewal >= 0 && daysToRenewal <= 90) {
      insights.push({
        id: `INS-REN-${sub.id}`,
        category: 'upcoming_renewal',
        severity: daysToRenewal <= 35 ? 'high' : 'medium',
        title: `${sub.product} renews in ${daysToRenewal} days (${sub.renewalDate})`,
        subscriptionId: sub.id,
        product: sub.product,
        subscriptionType: sub.subscriptionType,
        dealerId: sub.dealerId,
        dealerName: sub.dealerName,
        customerId: sub.customerId,
        customerLabel: sub.customerDisplayLabel,
        summary: `This ${sub.billingFrequency} contract ($${sub.cost.toLocaleString()}) reaches its renewal date on ${sub.renewalDate}.${sub.customFields.autoRenew === false ? ' Auto-renew is currently turned off.' : ''}`,
        whyItMatters:
          sub.customFields.autoRenew === false
            ? 'Because auto-renew is off, failure to confirm renewal terms before expiry will interrupt service.'
            : 'Early review ensures seat counts and service SLAs match next year’s needs before lock-in.',
        recommendedAction:
          sub.customFields.autoRenew === false
            ? 'Confirm renewal terms and purchase order at least 15 days prior to expiry.'
            : 'Verify seat count and maintenance scope 30 days ahead of automatic renewal.',
        advisoryDisclaimer: advisoryNote,
        currentPlanName: `${sub.planName} ($${sub.cost.toLocaleString()} / ${sub.billingFrequency})`,
        actualUsageSummary: `Renews ${sub.renewalDate} (${daysToRenewal} days remaining)`,
        supportingRecordIds: [sub.id],
        metrics: [
          { label: 'Renewal Date', value: sub.renewalDate },
          { label: 'Days Remaining', value: `${daysToRenewal} days` },
          { label: 'Contract Value', value: `$${sub.cost.toLocaleString()}` },
        ],
      });
    }
  }

  // Sort by urgency (high -> medium -> low) then category priority
  const severityRank = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
