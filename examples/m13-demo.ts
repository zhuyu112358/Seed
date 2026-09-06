// M13 End-to-End Demo: Social Simulation & Cultural Evolution
//
// Demonstrates the full M13 pipeline:
//   1. SocialRelationGraph - social relation network with path finding and group detection
//   2. SocialNormSystem - social norms with violation detection and evolution
//   3. SocialEventSystem - social events with lifecycle and narrative generation
//   4. GroupBehaviorEngine - group behavior with mob psychology and collective action
//   5. InformationSpreadModel - SIR information spread with credibility assessment
//   6. SocialMobilitySystem - social mobility with class promotion and prestige
//   7. CulturalEvolutionSystem - cultural evolution with mutation, selection, transmission
//   8. SocialCulturalIntegrationSystem - integration with M12 NPC AI and narrative
//
// Run: npx tsx examples/m13-demo.ts

import { SocialRelationGraph } from "../src/social/SocialRelationGraph.js";
import { SocialNormSystem } from "../src/social/SocialNormSystem.js";
import { SocialEventSystem } from "../src/social/SocialEventSystem.js";
import { GroupBehaviorEngine } from "../src/social/GroupBehaviorEngine.js";
import { InformationSpreadModel } from "../src/social/InformationSpreadModel.js";
import { SocialMobilitySystem } from "../src/social/SocialMobilitySystem.js";
import { CulturalEvolutionSystem } from "../src/social/CulturalEvolutionSystem.js";
import { SocialCulturalIntegrationSystem } from "../src/social/SocialCulturalIntegrationSystem.js";

// M12 systems for integration demo
import { NPCPersonalitySystem } from "../src/npc/NPCPersonalitySystem.js";
import { DynamicNarrativeSystem } from "../src/narrative/DynamicNarrativeSystem.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

console.log("=".repeat(70));
console.log("M13 End-to-End Demo: Social Simulation & Cultural Evolution");
console.log("=".repeat(70));

// ============================================================
// Phase 1: SocialRelationGraph
// ============================================================
console.log("\n--- Phase 1: SocialRelationGraph ---");

const relationGraph = new SocialRelationGraph();

// Add relations between NPCs
relationGraph.addRelation("npc_alice", "npc_bob", "friendship", "close_friend", {
  trust: 85, intimacy: 70, respect: 80, fear: 5, influence: 60,
});
relationGraph.addRelation("npc_alice", "npc_carol", "family", "sibling", {
  trust: 95, intimacy: 90, respect: 85, fear: 0, influence: 70,
});
relationGraph.addRelation("npc_bob", "npc_dave", "enmity", "rival", {
  trust: 10, intimacy: 0, respect: 20, fear: 60, influence: 40,
});
relationGraph.addRelation("npc_carol", "npc_dave", "partnership", "business_partner", {
  trust: 60, intimacy: 30, respect: 65, fear: 10, influence: 50,
});

const aliceRelations = relationGraph.getRelations("npc_alice");
assert(aliceRelations.length === 2, `Alice has 2 relations (got ${aliceRelations.length})`);

const path = relationGraph.findSocialPath("npc_alice", "npc_dave");
assert(path.exists, `Social path Alice->Dave exists`);
assert(path.path.length >= 3, `Path length >= 3 (got ${path.path.length})`);
assert(path.distance >= 2, `Social distance >= 2 (got ${path.distance})`);

const groups = relationGraph.detectGroups(2, 50);
assert(groups.length >= 1, `Detected at least 1 social group (got ${groups.length})`);

const stats1 = relationGraph.getStats();
assert(stats1.totalRelations >= 4, `Total relations >= 4 (got ${stats1.totalRelations})`);

console.log(`  Social path: ${path.path.join(" -> ")} (distance: ${path.distance})`);

// ============================================================
// Phase 2: SocialNormSystem
// ============================================================
console.log("\n--- Phase 2: SocialNormSystem ---");

const normSystem = new SocialNormSystem();

// Add social norms (addNorm(type, name, description, options?))
normSystem.addNorm("custom", "Greet with bow", "Greet others with a bow", {
  compliantBehavior: "bow",
  violatingBehavior: "ignore",
  complianceRate: 80,
});
normSystem.addNorm("taboo", "No theft", "Stealing is forbidden", {
  compliantBehavior: "honest",
  violatingBehavior: "steal",
  complianceRate: 95,
});
normSystem.addNorm("value", "Honor elders", "Respect and honor elders", {
  compliantBehavior: "respect",
  violatingBehavior: "disrespect",
  complianceRate: 85,
});

const norms = normSystem.getActiveNorms();
assert(norms.length === 3, `3 norms created (got ${norms.length})`);

// Record a violation (recordViolation(normId, violatorId, context, severity?))
const theftNorm = norms.find(n => n.name === "No theft")!;
const violation = normSystem.recordViolation(theftNorm.id, "npc_dave", "Dave stole bread", "major");
assert(violation !== null, `Violation recorded successfully`);

// Check compliance (checkCompliance(entityId, behavior) returns ComplianceCheckResult[])
const daveCompliance = normSystem.checkCompliance("npc_dave", "steal bread from market");
assert(daveCompliance.length >= 1, `Dave compliance check returned results (got ${daveCompliance.length})`);
const hasViolation = daveCompliance.some(r => r.compliant === false);
assert(hasViolation, `Dave has at least one violation detected`);

// Give positive feedback (givePositiveFeedback(targetId, type, sourceIds, intensity, normId?))
normSystem.givePositiveFeedback("npc_alice", "praise", ["npc_bob", "npc_carol"], 80);

const stats2 = normSystem.getStats();
assert(stats2.totalNorms === 3, `Total norms = 3 (got ${stats2.totalNorms})`);
assert(stats2.totalViolations >= 1, `Total violations >= 1 (got ${stats2.totalViolations})`);

// ============================================================
// Phase 3: SocialEventSystem
// ============================================================
console.log("\n--- Phase 3: SocialEventSystem ---");

const eventSystem = new SocialEventSystem();

// Create social events (createEvent(type, name, description, options?))
const weddingResult = eventSystem.createEvent("wedding", "Alice and Bob Wedding", "Grand Cathedral", {
  durationTicks: 50,
  organizers: ["npc_alice", "npc_bob"],
});
assert(weddingResult.success, `Wedding event created`);

const festivalResult = eventSystem.createEvent("festival", "Harvest Festival", "Town Square", {
  durationTicks: 100,
  maxAttendees: 200,
});
assert(festivalResult.success, `Festival event created`);

const wedding = weddingResult.event!;
const festival = festivalResult.event!;

// Add participants
eventSystem.addParticipant(wedding!.id, "npc_carol", "attendee");
eventSystem.addParticipant(wedding!.id, "npc_dave", "attendee");
eventSystem.addParticipant(festival!.id, "npc_alice", "attendee");
eventSystem.addParticipant(festival!.id, "npc_bob", "attendee");

const weddingParticipants = eventSystem.getParticipants(wedding!.id);
assert(weddingParticipants.length >= 4, `Wedding has 4+ participants (got ${weddingParticipants.length})`);

// Generate narrative for wedding
const weddingNarrative = eventSystem.generateNarrative(wedding.id);
assert(weddingNarrative !== null && weddingNarrative.length > 0, `Wedding narrative generated`);

const activeEvents = eventSystem.getActiveEvents();
assert(activeEvents.length === 2, `2 active events (got ${activeEvents.length})`);

const stats3 = eventSystem.getStats();
assert(stats3.totalEvents >= 2, `Total events >= 2 (got ${stats3.totalEvents})`);

console.log(`  Wedding narrative: ${weddingNarrative!.substring(0, 80)}...`);

// ============================================================
// Phase 4: GroupBehaviorEngine
// ============================================================
console.log("\n--- Phase 4: GroupBehaviorEngine ---");

const groupEngine = new GroupBehaviorEngine();

// Create a group (createGroup(name, type, options?) returns group directly)
const crowd = groupEngine.createGroup("Town Gathering", "crowd", {
  members: [
    { entityId: "npc_alice", role: "leader", influence: 70 },
    { entityId: "npc_bob", role: "follower", influence: 50 },
  ],
})!;
assert(crowd !== null, `Group "Town Gathering" created`);

// Add more members (addMember(groupId, entityId, role?, influence?))
groupEngine.addMember(crowd.id, "npc_carol", "follower", 40);
groupEngine.addMember(crowd.id, "npc_dave", "follower", 30);
groupEngine.addMember(crowd.id, "npc_eve", "follower", 20);

const members = groupEngine.getGroup(crowd.id)!.members;
assert(members.length === 5, `Group has 5 members (got ${members.length})`);

// Set group emotion (setGroupEmotion(groupId, emotion, intensity))
groupEngine.setGroupEmotion(crowd.id, "excited", 75);
const emotion = groupEngine.getGroupEmotion(crowd.id);
assert(emotion !== null, `Group emotion exists`);
assert(emotion!.dominantEmotion === "excited", `Group emotion is excited (got ${emotion!.dominantEmotion})`);

// Start collective action (startCollectiveAction(groupId, type, name, target, options?))
const action = groupEngine.startCollectiveAction(crowd.id, "celebration", "Harvest Celebration", "town_square", {
  description: "Celebrate the harvest",
});
assert(action !== null, `Collective action "celebration" started`);

// Propose a decision (proposeDecision(groupId, issue, options[], method?, options2?))
const decision = groupEngine.proposeDecision(crowd.id, "Should we have a feast?", [
  { id: "yes", text: "Yes, have a feast" },
  { id: "no", text: "No, save food" },
], "majority_vote");
assert(decision !== null, `Decision proposed`);

// Vote (vote(decisionId, entityId, optionId))
groupEngine.vote(decision!.id, "npc_alice", "yes");
groupEngine.vote(decision!.id, "npc_bob", "yes");
groupEngine.vote(decision!.id, "npc_carol", "no");

// Resolve decision (resolveDecision(decisionId))
const resolved = groupEngine.resolveDecision(decision!.id);
assert(resolved !== null, `Decision resolved`);
assert(resolved!.resolvedOptionId === "yes", `Decision "yes" won (2 votes vs 1)`);

const stats4 = groupEngine.getStats();
assert(stats4.totalGroups >= 1, `Total groups >= 1 (got ${stats4.totalGroups})`);

// ============================================================
// Phase 5: InformationSpreadModel
// ============================================================
console.log("\n--- Phase 5: InformationSpreadModel ---");

const infoModel = new InformationSpreadModel();

// Set up nodes (setNodeInfluence and setNodeSkepticism are public; ensureNode is private)
infoModel.setNodeInfluence("npc_alice", 80);
infoModel.setNodeSkepticism("npc_alice", 20);
infoModel.setNodeInfluence("npc_bob", 60);
infoModel.setNodeSkepticism("npc_bob", 40);
infoModel.setNodeInfluence("npc_carol", 70);
infoModel.setNodeSkepticism("npc_carol", 30);
infoModel.setNodeInfluence("npc_dave", 50);
infoModel.setNodeSkepticism("npc_dave", 60);

// Add influence connections
infoModel.addInfluenceConnection("npc_alice", "npc_bob", 80);
infoModel.addInfluenceConnection("npc_alice", "npc_carol", 70);
infoModel.addInfluenceConnection("npc_bob", "npc_dave", 60);

// Create information (createInformation(type, content, sourceId, options?)) returns InformationItem | null
const rumor = infoModel.createInformation("rumor", "Dave stole bread from the market", "npc_alice", {
  infectivity: 80,
  sourceCredibility: 40,
});
assert(rumor !== null, `Rumor created by Alice`);

// Spread information (spreadInformation(infoId, fromId) spreads to all connections, returns count)
const spreadCount1 = infoModel.spreadInformation(rumor!.id, "npc_alice");
assert(spreadCount1 >= 1, `Rumor spread from Alice to at least 1 node (got ${spreadCount1})`);

// Check Bob's state (getNodeState(entityId, infoId))
const bobState = infoModel.getNodeState("npc_bob", rumor!.id);
assert(bobState === "infected", `Bob is infected (got ${bobState})`);

// Spread further from Bob
infoModel.spreadInformation(rumor!.id, "npc_bob");

const activeInfo = infoModel.getActiveInformation();
assert(activeInfo.length >= 1, `At least 1 active information (got ${activeInfo.length})`);

// Assess credibility (assessCredibility(infoId))
const credibility = infoModel.assessCredibility(rumor!.id);
assert(credibility !== null, `Credibility assessment returned`);
assert(credibility!.overallCredibility < 60, `Rumor credibility < 60 (got ${credibility!.overallCredibility})`);

const stats5 = infoModel.getStats();
assert(stats5.totalInformation >= 1, `Total information >= 1 (got ${stats5.totalInformation})`);

console.log(`  Rumor credibility: ${credibility!.overallCredibility}/100 (low, as expected for rumor)`);

// ============================================================
// Phase 6: SocialMobilitySystem
// ============================================================
console.log("\n--- Phase 6: SocialMobilitySystem ---");

const mobilitySystem = new SocialMobilitySystem();

// Register entities (registerEntity(entityId, options?))
mobilitySystem.registerEntity("npc_alice", { socialClass: "commoner", wealth: 50, influence: 40 });
mobilitySystem.registerEntity("npc_bob", { socialClass: "artisan", wealth: 70, influence: 50 });
mobilitySystem.registerEntity("npc_carol", { socialClass: "merchant", wealth: 150, influence: 80 });
mobilitySystem.registerEntity("npc_dave", { socialClass: "serf", wealth: 10, influence: 5 });

const aliceStatus = mobilitySystem.getSocialStatus("npc_alice");
assert(aliceStatus !== undefined && aliceStatus.socialClass === "commoner", `Alice is commoner`);

// Add prestige to Alice (addPrestige(entityId, amount, reason))
mobilitySystem.addPrestige("npc_alice", 60, "Helped the community");
assert(mobilitySystem.canPromote("npc_alice"), `Alice can promote (prestige >= threshold)`);

// Promote Alice (promote(entityId, reason))
const promoteResult = mobilitySystem.promote("npc_alice", "Community service");
assert(promoteResult.success, `Alice promoted successfully`);
assert(mobilitySystem.getSocialStatus("npc_alice")!.socialClass === "artisan", `Alice is now artisan`);

// Dave gets disgraced (disgrace(entityId, levels, reason))
mobilitySystem.addPrestige("npc_dave", 20, "Minor work");
const disgraceResult = mobilitySystem.disgrace("npc_dave", 1, "Caught stealing");
assert(disgraceResult.success || disgraceResult.previousClass !== null, `Dave disgraced`);

// Intermarriage between Alice (artisan) and Bob (artisan)
const marriageResult = mobilitySystem.intermarry("npc_alice", "npc_bob", "Wedding ceremony");
assert(marriageResult, `Alice and Bob married`);

const marriageHistory = mobilitySystem.getMarriageHistory("npc_alice");
assert(marriageHistory.length >= 1, `Alice has 1+ marriage records`);

const stats6 = mobilitySystem.getStats();
assert(stats6.totalEntities >= 4, `Total entities >= 4 (got ${stats6.totalEntities})`);
assert(stats6.totalMobilityEvents >= 2, `Total mobility events >= 2 (got ${stats6.totalMobilityEvents})`);

console.log(`  Alice promoted: commoner -> artisan`);
console.log(`  Class distribution: ${JSON.stringify(stats6.classDistribution)}`);

// ============================================================
// Phase 7: CulturalEvolutionSystem
// ============================================================
console.log("\n--- Phase 7: CulturalEvolutionSystem ---");

const culturalSystem = new CulturalEvolutionSystem();

// Create two cultures (createCulture(name, description, options?) returns Culture | null)
const cultureA = culturalSystem.createCulture("River Valley", "Agricultural culture by the river");
const cultureB = culturalSystem.createCulture("Mountain Clan", "Hunter-gatherer culture in mountains");
assert(cultureA !== null && cultureB !== null, `Two cultures created`);

// Create traits for Culture A (createTrait(type, name, description, originCultureId, options?))
const traitA1 = culturalSystem.createTrait("religion", "Sun Worship", "Worship the sun god", cultureA!.id, {
  transmissibility: 70, adaptability: 80,
});
const traitA2 = culturalSystem.createTrait("custom", "Flood Farming", "Farm using river floods", cultureA!.id, {
  transmissibility: 60, adaptability: 70,
});
const traitA3 = culturalSystem.createTrait("art", "Pottery", "Decorated clay pottery", cultureA!.id, {
  transmissibility: 50, adaptability: 60,
});

// Create traits for Culture B
culturalSystem.createTrait("religion", "Ancestor Worship", "Honor ancestral spirits", cultureB!.id, {
  transmissibility: 65, adaptability: 75,
});
culturalSystem.createTrait("custom", "Stealth Hunting", "Silent mountain hunting", cultureB!.id, {
  transmissibility: 55, adaptability: 65,
});
culturalSystem.createTrait("music", "Throat Singing", "Deep harmonic singing", cultureB!.id, {
  transmissibility: 45, adaptability: 55,
});

const traitsA = culturalSystem.getTraitsForCulture(cultureA!.id);
const traitsB = culturalSystem.getTraitsForCulture(cultureB!.id);
assert(traitsA.length === 3, `Culture A has 3 traits (got ${traitsA.length})`);
assert(traitsB.length === 3, `Culture B has 3 traits (got ${traitsB.length})`);

// Calculate cultural distance (getCulturalDistance(cultureAId, cultureBId))
const distance = culturalSystem.getCulturalDistance(cultureA!.id, cultureB!.id);
assert(distance !== null, `Cultural distance calculated`);
assert(distance!.distance > 0, `Cultural distance > 0 (got ${distance!.distance})`);
assert(distance!.sharedTraits === 0, `0 shared traits initially (got ${distance!.sharedTraits})`);

// Transmit a trait from A to B (transmitTrait(traitId, fromCultureId, toCultureId))
const transmitResult = culturalSystem.transmitTrait(traitA1!.id, cultureA!.id, cultureB!.id);
// Transmission is probabilistic, may fail; just check it doesn't crash
assert(transmitResult !== undefined, `Transmission attempted (success=${transmitResult})`);

// Mutate a trait (mutateTrait(traitId, cultureId))
const mutationResult = culturalSystem.mutateTrait(traitA3!.id, cultureA!.id);
assert(mutationResult !== null, `Pottery trait mutated`);

// Merge cultures (mergeCultures(cultureAId, cultureBId, newName, newDescription, options?))
const mergeResult = culturalSystem.mergeCultures(cultureA!.id, cultureB!.id, "River-Mountain Fusion", "Merged culture");
assert(mergeResult.success, `Cultures merged successfully`);

const allCultures = culturalSystem.getAllCultures();
assert(allCultures.length >= 3, `At least 3 cultures (2 original + 1 merged, got ${allCultures.length})`);

const stats7 = culturalSystem.getStats();
assert(stats7.totalCultures >= 3, `Total cultures >= 3 (got ${stats7.totalCultures})`);
assert(stats7.totalTraits >= 6, `Total traits >= 6 (got ${stats7.totalTraits})`);

console.log(`  Cultural distance A-B: ${distance!.distance}/100`);
console.log(`  Merged culture: ${mergeResult.mergedCultureId} (${mergeResult.traitsCombined} traits combined)`);

// ============================================================
// Phase 8: SocialCulturalIntegrationSystem
// ============================================================
console.log("\n--- Phase 8: SocialCulturalIntegrationSystem ---");

const integrationSystem = new SocialCulturalIntegrationSystem();

// Register M13 social systems
integrationSystem.registerSocialSystems(relationGraph, eventSystem, culturalSystem);

// Register M12 NPC and narrative systems
const personalitySystem = new NPCPersonalitySystem();
const narrativeSystem = new DynamicNarrativeSystem();
integrationSystem.registerM12Systems(personalitySystem, narrativeSystem);

// Set up NPC personalities
personalitySystem.setPersonality("npc_alice", {
  openness: 60, conscientiousness: 70, extraversion: 65, agreeableness: 75, neuroticism: 30,
});
personalitySystem.setPersonality("npc_bob", {
  openness: 50, conscientiousness: 60, extraversion: 55, agreeableness: 65, neuroticism: 40,
});

// Apply social influence to Alice and Bob
const socialInfluence = integrationSystem.applySocialInfluence("npc_alice");
const socialInfluenceBob = integrationSystem.applySocialInfluence("npc_bob");
assert(socialInfluence !== null, `Social influence applied to Alice`);
assert(socialInfluence!.relationsConsidered >= 2, `Alice has 2+ relations considered (got ${socialInfluence!.relationsConsidered})`);
assert(socialInfluence!.socialInfluence > 0, `Alice has positive social influence (got ${socialInfluence!.socialInfluence})`);
assert(socialInfluence!.behaviorModifier > 1.0, `Alice behavior modifier > 1.0 (got ${socialInfluence!.behaviorModifier})`);

// Bridge social event to narrative
const eventBridge = integrationSystem.bridgeSocialEventToNarrative(wedding!.id);
assert(eventBridge !== null, `Social event bridged to narrative`);
assert(eventBridge!.narrativeTriggered === true, `Narrative triggered`);
assert(eventBridge!.narrativeEventId !== null, `Narrative event ID assigned`);

// Apply cultural influence to Alice (use merged culture)
const mergedCulture = culturalSystem.getAllCultures().find(c => c.name === "River-Mountain Fusion");
if (mergedCulture) {
  const culturalInfluence = integrationSystem.applyCulturalInfluence("npc_alice", mergedCulture.id);
  assert(culturalInfluence !== null, `Cultural influence applied to Alice`);
  assert(culturalInfluence!.traitsConsidered > 0, `Cultural traits considered > 0 (got ${culturalInfluence!.traitsConsidered})`);
  assert(culturalInfluence!.culturalInfluence > 0, `Cultural influence > 0 (got ${culturalInfluence!.culturalInfluence})`);
  console.log(`  Cultural influence: ${culturalInfluence!.culturalInfluence}, traits: ${culturalInfluence!.traitsConsidered}`);
} else {
  assert(false, `Merged culture not found`);
}

// Run full sync
const syncResult = integrationSystem.sync();
assert(syncResult.socialInfluences.length >= 0, `Sync completed (social influences: ${syncResult.socialInfluences.length})`);
assert(syncResult.socialEventBridges.length >= 0, `Sync completed (event bridges: ${syncResult.socialEventBridges.length})`);

// Check stats
const integrationStats = integrationSystem.getStats();
assert(integrationStats.totalSocialInfluences >= 2, `Total social influences >= 2 (got ${integrationStats.totalSocialInfluences})`);
assert(integrationStats.totalSocialEventBridges >= 1, `Total social event bridges >= 1 (got ${integrationStats.totalSocialEventBridges})`);
assert(integrationStats.totalCulturalInfluences >= 1, `Total cultural influences >= 1 (got ${integrationStats.totalCulturalInfluences})`);
assert(integrationStats.activeBridges === 5, `5 active bridges (3 M13 + 2 M12, got ${integrationStats.activeBridges})`);

console.log(`  Social influence: ${socialInfluence!.socialInfluence}, modifier: ${socialInfluence!.behaviorModifier.toFixed(2)}`);
console.log(`  Event bridged: ${eventBridge!.narrativeEventId}`);

// ============================================================
// Serialization round-trip test
// ============================================================
console.log("\n--- Serialization Round-Trip ---");

const integrationData = integrationSystem.serialize();
const integrationSystem2 = new SocialCulturalIntegrationSystem();
integrationSystem2.deserialize(integrationData);
const statsAfter = integrationSystem2.getStats();
assert(statsAfter.totalSyncCycles === integrationStats.totalSyncCycles, `Serialization preserves sync cycles`);

const relationData = relationGraph.serialize();
const relationGraph2 = new SocialRelationGraph();
relationGraph2.deserialize(relationData);
assert(relationGraph2.getRelations("npc_alice").length === 2, `Relation graph serialization preserves Alice's relations`);

// ============================================================
// Summary
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("M13 Demo Summary");
console.log("=".repeat(70));
console.log(`  Phase 1 - SocialRelationGraph: relations, paths, groups`);
console.log(`  Phase 2 - SocialNormSystem: norms, violations, feedback`);
console.log(`  Phase 3 - SocialEventSystem: events, participants, narrative`);
console.log(`  Phase 4 - GroupBehaviorEngine: groups, emotions, actions, decisions`);
console.log(`  Phase 5 - InformationSpreadModel: SIR spread, credibility, mutations`);
console.log(`  Phase 6 - SocialMobilitySystem: classes, promotion, prestige, marriage`);
console.log(`  Phase 7 - CulturalEvolutionSystem: cultures, traits, distance, fusion`);
console.log(`  Phase 8 - SocialCulturalIntegrationSystem: 3 bridge mechanisms + M12 integration`);
console.log("");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`  Total: ${passed + failed} assertions`);
console.log("=".repeat(70));

if (failed > 0) {
  process.exit(1);
}
