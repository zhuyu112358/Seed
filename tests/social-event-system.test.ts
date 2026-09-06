// M13 SocialEventSystem tests.
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { SocialEventSystem } from "../src/social/SocialEventSystem.js";
import { DEFAULT_SOCIAL_EVENT_CONFIG } from "../src/social/SocialEventTypes.js";
import type {
  SocialEventType,
  EventParticipantRole,
} from "../src/social/SocialEventTypes.js";

describe("SocialEventSystem - Event Management", () => {
  let system: SocialEventSystem;

  beforeEach(() => {
    system = new SocialEventSystem();
  });

  test("createEvent creates a new event", () => {
    const result = system.createEvent("wedding", "Royal Wedding", "A grand ceremony");
    assert.equal(result.success, true);
    assert.ok(result.event);
    assert.equal(result.event!.type, "wedding");
    assert.equal(result.event!.name, "Royal Wedding");
    assert.equal(result.event!.status, "scheduled");
  });

  test("createEvent emits scheduled event", () => {
    const result = system.createEvent("festival", "Harvest Festival", "Annual celebration");
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "social_event.scheduled");
    assert.equal(result.events[0].description, "Event scheduled: Harvest Festival (festival) at unknown");
  });

  test("createEvent accepts custom options", () => {
    const result = system.createEvent("war", "Great War", "Conflict between kingdoms", {
      location: "Borderlands",
      durationTicks: 500,
      maxAttendees: 1000,
      organizers: ["king_1", "king_2"],
      isPublic: false,
    });
    assert.equal(result.event!.location, "Borderlands");
    assert.equal(result.event!.durationTicks, 500);
    assert.equal(result.event!.maxAttendees, 1000);
    assert.equal(result.event!.isPublic, false);
    assert.equal(result.event!.participants.length, 2);
    assert.equal(result.event!.participants[0].role, "organizer");
  });

  test("createEvent enforces maxActiveEvents limit", () => {
    const limited = new SocialEventSystem({ maxActiveEvents: 1 });
    limited.createEvent("wedding", "Event 1", "desc");
    const result = limited.createEvent("funeral", "Event 2", "desc");
    assert.equal(result.success, false);
    assert.equal(result.failureReason, "Max active events exceeded");
  });

  test("getEvent returns event by ID", () => {
    const result = system.createEvent("celebration", "Victory Day", "desc");
    const event = system.getEvent(result.event!.id);
    assert.ok(event);
    assert.equal(event!.name, "Victory Day");
  });

  test("getEvent returns undefined for unknown ID", () => {
    assert.equal(system.getEvent("nonexistent"), undefined);
  });

  test("getActiveEvents returns scheduled and ongoing events", () => {
    const r1 = system.createEvent("wedding", "Scheduled", "desc");
    const r2 = system.createEvent("funeral", "Scheduled 2", "desc");
    assert.equal(system.getActiveEvents().length, 2);
  });

  test("getOngoingEvents returns only ongoing events", () => {
    const r1 = system.createEvent("wedding", "Event", "desc", { scheduledStartTick: 0 });
    // Tick to start the event.
    system.tick(1 / 60, {} as any, {} as any);
    assert.equal(system.getOngoingEvents().length, 1);
    assert.equal(system.getOngoingEvents()[0].status, "ongoing");
  });

  test("getEventsByType filters by type", () => {
    system.createEvent("wedding", "Wedding 1", "desc");
    system.createEvent("wedding", "Wedding 2", "desc");
    system.createEvent("funeral", "Funeral 1", "desc");
    assert.equal(system.getEventsByType("wedding").length, 2);
    assert.equal(system.getEventsByType("funeral").length, 1);
  });

  test("getEventsAtLocation filters by location", () => {
    system.createEvent("festival", "Festival", "desc", { location: "Town Square" });
    system.createEvent("wedding", "Wedding", "desc", { location: "Cathedral" });
    assert.equal(system.getEventsAtLocation("Town Square").length, 1);
    assert.equal(system.getEventsAtLocation("Nowhere").length, 0);
  });

  test("cancelEvent deactivates event", () => {
    const result = system.createEvent("protest", "Cancelled Protest", "desc");
    assert.equal(system.cancelEvent(result.event!.id, "Permit revoked"), true);
    // Event moves to history after cancellation.
    const allEvents = system.getAllEvents();
    assert.equal(allEvents.find((e) => e.id === result.event!.id)!.status, "cancelled");
    assert.equal(system.getActiveEvents().length, 0);
  });

  test("cancelEvent returns false for completed event", () => {
    const result = system.createEvent("wedding", "Event", "desc", { scheduledStartTick: 0, durationTicks: 1 });
    system.tick(1 / 60, {} as any, {} as any); // start
    system.tick(1 / 60, {} as any, {} as any); // complete
    assert.equal(system.cancelEvent(result.event!.id), false);
  });

  test("completeEvent marks event as completed", () => {
    const result = system.createEvent("wedding", "Event", "desc", { scheduledStartTick: 0 });
    system.tick(1 / 60, {} as any, {} as any); // start
    assert.equal(system.completeEvent(result.event!.id), true);
    // Event moves to history after completion.
    const allEvents = system.getAllEvents();
    assert.equal(allEvents.find((e) => e.id === result.event!.id)!.status, "completed");
  });
});

describe("SocialEventSystem - Participation", () => {
  let system: SocialEventSystem;

  beforeEach(() => {
    system = new SocialEventSystem();
  });

  test("addParticipant adds entity to event", () => {
    const result = system.createEvent("wedding", "Wedding", "desc");
    assert.equal(system.addParticipant(result.event!.id, "npc_1", "guest_of_honor"), true);
    const participants = system.getParticipants(result.event!.id);
    assert.equal(participants.length, 1);
    assert.equal(participants[0].entityId, "npc_1");
    assert.equal(participants[0].role, "guest_of_honor");
    assert.equal(participants[0].status, "confirmed");
  });

  test("addParticipant defaults to attendee role", () => {
    const result = system.createEvent("festival", "Festival", "desc");
    system.addParticipant(result.event!.id, "npc_1");
    assert.equal(system.getParticipants(result.event!.id)[0].role, "attendee");
  });

  test("addParticipant rejects duplicate entity", () => {
    const result = system.createEvent("wedding", "Wedding", "desc");
    system.addParticipant(result.event!.id, "npc_1");
    assert.equal(system.addParticipant(result.event!.id, "npc_1"), false);
  });

  test("addParticipant respects maxAttendees", () => {
    const result = system.createEvent("gathering", "Small Gathering", "desc", { maxAttendees: 2 });
    system.addParticipant(result.event!.id, "npc_1");
    system.addParticipant(result.event!.id, "npc_2");
    assert.equal(system.addParticipant(result.event!.id, "npc_3"), false);
  });

  test("addParticipant allows organizers beyond maxAttendees", () => {
    const result = system.createEvent("gathering", "Small", "desc", { maxAttendees: 1 });
    system.addParticipant(result.event!.id, "npc_1"); // attendee, fills quota
    assert.equal(system.addParticipant(result.event!.id, "organizer_1", "organizer"), true);
  });

  test("removeParticipant removes entity from scheduled event", () => {
    const result = system.createEvent("wedding", "Wedding", "desc");
    system.addParticipant(result.event!.id, "npc_1");
    assert.equal(system.removeParticipant(result.event!.id, "npc_1"), true);
    assert.equal(system.getParticipants(result.event!.id).length, 0);
  });

  test("removeParticipant marks as left for ongoing event", () => {
    const result = system.createEvent("festival", "Festival", "desc", { scheduledStartTick: 0 });
    system.addParticipant(result.event!.id, "npc_1");
    system.tick(1 / 60, {} as any, {} as any); // start event
    assert.equal(system.removeParticipant(result.event!.id, "npc_1"), true);
    const participant = system.getParticipants(result.event!.id).find((p) => p.entityId === "npc_1");
    assert.equal(participant!.status, "left");
  });

  test("getAttendees returns confirmed and attended participants", () => {
    const result = system.createEvent("wedding", "Wedding", "desc");
    system.addParticipant(result.event!.id, "npc_1");
    system.addParticipant(result.event!.id, "npc_2");
    assert.equal(system.getAttendees(result.event!.id).length, 2);
  });

  test("getEventsForEntity returns events entity participates in", () => {
    const r1 = system.createEvent("wedding", "Wedding", "desc");
    const r2 = system.createEvent("funeral", "Funeral", "desc");
    system.addParticipant(r1.event!.id, "npc_1");
    system.addParticipant(r2.event!.id, "npc_1");
    assert.equal(system.getEventsForEntity("npc_1").length, 2);
  });

  test("isParticipating returns correct boolean", () => {
    const result = system.createEvent("wedding", "Wedding", "desc");
    system.addParticipant(result.event!.id, "npc_1");
    assert.equal(system.isParticipating(result.event!.id, "npc_1"), true);
    assert.equal(system.isParticipating(result.event!.id, "npc_2"), false);
  });
});

describe("SocialEventSystem - Event Lifecycle", () => {
  let system: SocialEventSystem;

  beforeEach(() => {
    system = new SocialEventSystem();
  });

  test("tick progresses scheduled event to ongoing", () => {
    const result = system.createEvent("wedding", "Wedding", "desc", { scheduledStartTick: 5 });
    // Tick 4 times - event should still be scheduled.
    for (let i = 0; i < 4; i++) {
      system.tick(1 / 60, {} as any, {} as any);
    }
    assert.equal(system.getEvent(result.event!.id)!.status, "scheduled");

    // Tick once more - event should start.
    system.tick(1 / 60, {} as any, {} as any);
    assert.equal(system.getEvent(result.event!.id)!.status, "ongoing");
    assert.ok(system.getEvent(result.event!.id)!.actualStartTick !== null);
  });

  test("tick progresses ongoing event to completed after duration", () => {
    const result = system.createEvent("festival", "Festival", "desc", {
      scheduledStartTick: 0,
      durationTicks: 2,
    });
    system.tick(1 / 60, {} as any, {} as any); // tick 1: start (actualStartTick=1)
    assert.equal(system.getEvent(result.event!.id)!.status, "ongoing");
    system.tick(1 / 60, {} as any, {} as any); // tick 2: elapsed=1
    system.tick(1 / 60, {} as any, {} as any); // tick 3: elapsed=2 >= durationTicks=2, complete
    // Event moves to history after completion.
    const allEvents = system.getAllEvents();
    assert.equal(allEvents.find((e) => e.id === result.event!.id)!.status, "completed");
  });

  test("event start marks confirmed participants as attended", () => {
    const result = system.createEvent("wedding", "Wedding", "desc", { scheduledStartTick: 0 });
    system.addParticipant(result.event!.id, "npc_1");
    system.addParticipant(result.event!.id, "npc_2");
    system.tick(1 / 60, {} as any, {} as any); // start
    const participants = system.getParticipants(result.event!.id);
    assert.equal(participants[0].status, "attended");
    assert.equal(participants[1].status, "attended");
    assert.ok(participants[0].arrivalTick !== null);
  });

  test("autoProgress can be disabled", () => {
    const manual = new SocialEventSystem({ autoProgress: false });
    const result = manual.createEvent("wedding", "Wedding", "desc", { scheduledStartTick: 0 });
    manual.tick(1 / 60, {} as any, {} as any);
    // Event should remain scheduled because autoProgress is disabled.
    assert.equal(manual.getEvent(result.event!.id)!.status, "scheduled");
  });
});

describe("SocialEventSystem - Narrative Generation", () => {
  let system: SocialEventSystem;

  beforeEach(() => {
    system = new SocialEventSystem();
  });

  test("generateNarrative creates text for wedding", () => {
    const result = system.createEvent("wedding", "Royal Wedding", "desc", {
      location: "Grand Cathedral",
      organizers: ["king_1"],
    });
    system.addParticipant(result.event!.id, "npc_1");
    system.addParticipant(result.event!.id, "npc_2");
    const narrative = system.generateNarrative(result.event!.id);
    assert.ok(narrative);
    assert.ok(narrative!.includes("wedding"));
    assert.ok(narrative!.includes("Grand Cathedral"));
    assert.ok(narrative!.includes("king_1"));
  });

  test("generateNarrative creates text for funeral", () => {
    const result = system.createEvent("funeral", "State Funeral", "desc", {
      location: "Royal Mausoleum",
    });
    const narrative = system.generateNarrative(result.event!.id);
    assert.ok(narrative);
    assert.ok(narrative!.includes("funeral"));
    assert.ok(narrative!.includes("Royal Mausoleum"));
  });

  test("generateNarrative creates text for war", () => {
    const result = system.createEvent("war", "Great War", "desc", {
      location: "Borderlands",
    });
    const narrative = system.generateNarrative(result.event!.id);
    assert.ok(narrative);
    assert.ok(narrative!.includes("War"));
  });

  test("generateNarrative marks event as narrativeGenerated", () => {
    const result = system.createEvent("festival", "Festival", "desc");
    system.generateNarrative(result.event!.id);
    assert.equal(system.getEvent(result.event!.id)!.narrativeGenerated, true);
    assert.ok(system.getEvent(result.event!.id)!.narrativeText);
  });

  test("generateNarrative returns null for unknown event", () => {
    assert.equal(system.generateNarrative("nonexistent"), null);
  });

  test("autoGenerateNarrative generates narrative on event completion", () => {
    const result = system.createEvent("wedding", "Wedding", "desc", {
      scheduledStartTick: 0,
      durationTicks: 1,
    });
    system.tick(1 / 60, {} as any, {} as any); // tick 1: start (actualStartTick=1)
    system.tick(1 / 60, {} as any, {} as any); // tick 2: elapsed=1 >= durationTicks=1, complete
    const allEvents = system.getAllEvents();
    const event = allEvents.find((e) => e.id === result.event!.id)!;
    assert.equal(event.narrativeGenerated, true);
  });
});

describe("SocialEventSystem - Social Impact", () => {
  let system: SocialEventSystem;

  beforeEach(() => {
    system = new SocialEventSystem();
  });

  test("applySocialImpact applies configured impact rules", () => {
    const result = system.createEvent("wedding", "Wedding", "desc", {
      socialImpact: [
        {
          relationCategory: "friendship",
          strengthDelta: { trust: 10, intimacy: 15 },
          affectedPairs: "all",
        },
      ],
    });
    assert.equal(system.applySocialImpact(result.event!.id), true);
  });

  test("applySocialImpact returns false for event with no impact rules", () => {
    const result = system.createEvent("gathering", "Casual", "desc");
    assert.equal(system.applySocialImpact(result.event!.id), false);
  });

  test("getSocialImpact returns configured rules", () => {
    const impact = [
      { relationCategory: "enmity", strengthDelta: { fear: 20 }, affectedPairs: "all" as const },
    ];
    const result = system.createEvent("war", "War", "desc", { socialImpact: impact });
    assert.equal(system.getSocialImpact(result.event!.id).length, 1);
    assert.equal(system.getSocialImpact(result.event!.id)[0].relationCategory, "enmity");
  });
});

describe("SocialEventSystem - Serialization", () => {
  test("serialize and deserialize preserves events and participants", () => {
    const system1 = new SocialEventSystem();
    const result = system1.createEvent("wedding", "Royal Wedding", "desc", {
      location: "Cathedral",
      organizers: ["king_1"],
    });
    system1.addParticipant(result.event!.id, "npc_1", "guest_of_honor");
    system1.generateNarrative(result.event!.id);

    const data = system1.serialize();
    const system2 = new SocialEventSystem();
    system2.deserialize(data);

    assert.equal(system2.getAllEvents().length, 1);
    assert.equal(system2.getAllEvents()[0].name, "Royal Wedding");
    assert.equal(system2.getParticipants(result.event!.id).length, 2); // organizer + guest
    assert.equal(system2.getAllEvents()[0].narrativeGenerated, true);
  });
});

describe("SocialEventSystem - Statistics", () => {
  test("getStats returns correct counts", () => {
    const system = new SocialEventSystem();
    system.createEvent("wedding", "Wedding", "desc");
    system.createEvent("funeral", "Funeral", "desc");
    system.createEvent("festival", "Festival", "desc");

    const stats = system.getStats();
    assert.equal(stats.totalEvents, 3);
    assert.equal(stats.scheduledEvents, 3);
    assert.equal(stats.eventsByType["wedding"], 1);
    assert.equal(stats.eventsByType["funeral"], 1);
    assert.equal(stats.eventsByType["festival"], 1);
  });
});

describe("SocialEventSystem - Configuration", () => {
  test("uses default config when none provided", () => {
    const system = new SocialEventSystem();
    const data = system.serialize();
    assert.deepEqual(data.config, DEFAULT_SOCIAL_EVENT_CONFIG);
  });

  test("accepts partial config override", () => {
    const system = new SocialEventSystem({ maxActiveEvents: 20, defaultDurationTicks: 200 });
    const data = system.serialize();
    assert.equal(data.config.maxActiveEvents, 20);
    assert.equal(data.config.defaultDurationTicks, 200);
    assert.equal(data.config.autoProgress, true); // default preserved
  });
});
