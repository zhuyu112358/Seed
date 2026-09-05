/**
 * Seed Evaluator CLI entry point.
 *
 * Builds a test world with 50 entities, runs the WorldEvaluator for 5 seconds,
 * prints and persists the report to evaluations/report-<timestamp>.json.
 * Run with: npm run evaluate
 */

import path from 'node:path';
import { WorldBuilder } from '../sdk/WorldBuilder.js';
import { EntityFactory } from '../sdk/EntityFactory.js';
import { WorldEvaluator } from './WorldEvaluator.js';
import { Logger } from '../reliability/Logger.js';
import type { WorldEngine } from '../engine/WorldEngine.js';

const log = Logger.for('evaluate');

async function main(): Promise<void> {
  const factory = new EntityFactory();
  const builder = new WorldBuilder()
    .createWorld({ name: 'benchmark-world', tickRate: 60 })
    .enableClock(60)
    .enableEvents();

  // Ground + boundary.
  builder.addEntity(factory.createGround({ x: 0, y: -0.5, z: 0 }, { x: 100, y: 1, z: 100 }, 'stone'));

  // Scatter 50 dynamic boxes.
  for (let i = 0; i < 50; i++) {
    builder.addEntity(
      factory.createBox(
        { x: (i % 10) * 2 - 10, y: 5 + Math.floor(i / 10), z: (i % 5) * 2 - 5 },
        0.8,
        'wood',
      ),
    );
  }

  const world = await builder.buildAndStart();
  log.info('benchmark world started', { entities: world.getStats().entityCount });

  const evaluator = new WorldEvaluator({
    worldEngine: world as unknown as WorldEngine,
    durationMs: 5000,
  });

  await evaluator.startEvaluation();
  const report = evaluator.generateReport();
  evaluator.printReport(report);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.resolve(process.cwd(), 'evaluations', `report-${stamp}.json`);
  await evaluator.saveReport(file);

  world.destroy();
  log.info('evaluation complete', { grade: report.grade, score: report.overallScore });
  process.exit(0);
}

main().catch((err) => {
  log.error('evaluation failed', { error: String(err) });
  process.exit(1);
});
