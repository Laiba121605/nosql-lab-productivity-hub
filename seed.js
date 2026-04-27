// seed.js
// =============================================================================
//  Seed the database with realistic test data.
//  Run with: npm run seed
//
//  Required minimum:
//    - 2 users
//    - 4 projects (split across the users)
//    - 5 tasks (with embedded subtasks and tags arrays)
//    - 5 notes (some attached to projects, some standalone)
//
//  Use the bcrypt module to hash passwords before inserting users.
//  Use ObjectId references for relationships (projectId, ownerId).
// =============================================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connect } = require('./db/connection');

(async () => {
  const db = await connect();

  // OPTIONAL: clear existing data so re-seeding is idempotent
  await db.collection('users').deleteMany({});
  await db.collection('projects').deleteMany({});
  await db.collection('tasks').deleteMany({});
  await db.collection('notes').deleteMany({});

  // =============================================================================
  //  1. USERS
  // =============================================================================
  const aliceHash = await bcrypt.hash('password123', 10);
  const bobHash   = await bcrypt.hash('securepass456', 10);

  const u1 = await db.collection('users').insertOne({
    email: 'alice@example.com',
    passwordHash: aliceHash,
    name: 'Alice Chen',
    createdAt: new Date('2025-12-01T09:00:00Z')
  });
  const aliceId = u1.insertedId;

  const u2 = await db.collection('users').insertOne({
    email: 'bob@example.com',
    passwordHash: bobHash,
    name: 'Bob Martinez',
    createdAt: new Date('2025-12-15T14:30:00Z')
  });
  const bobId = u2.insertedId;

  console.log('✅ Users seeded');

  // =============================================================================
  //  2. PROJECTS  (4 total, split across users)
  // =============================================================================
  const p1 = await db.collection('projects').insertOne({
    ownerId: aliceId,
    name: 'Personal Website Redesign',
    description: 'Modern portfolio site with blog',
    archived: false,
    createdAt: new Date('2026-01-10T08:00:00Z')
  });
  const webId = p1.insertedId;

  const p2 = await db.collection('projects').insertOne({
    ownerId: aliceId,
    name: 'Fitness Goals 2026',
    description: 'Training plan and meal prep',
    archived: false,
    createdAt: new Date('2026-01-02T12:00:00Z')
  });
  const fitnessId = p2.insertedId;

  const p3 = await db.collection('projects').insertOne({
    ownerId: bobId,
    name: 'Home Renovation',
    description: 'Kitchen and bathroom remodel',
    archived: false,
    createdAt: new Date('2026-02-01T10:00:00Z')
  });
  const renoId = p3.insertedId;

  const p4 = await db.collection('projects').insertOne({
    ownerId: aliceId,
    name: 'Book Club',
    description: null,                        // optional field explicitly null
    archived: true,
    createdAt: new Date('2025-06-15T18:00:00Z')
  });
  const bookClubId = p4.insertedId;

  console.log('✅ Projects seeded');

  // =============================================================================
  //  3. TASKS  (6 total — exceeds the 5 minimum)
  //     Demonstrates: embedded subtasks & tags, optional dueDate & description.
  // =============================================================================

  // --- Alice / Website project ---
  await db.collection('tasks').insertOne({
    ownerId: aliceId,
    projectId: webId,
    title: 'Design homepage mockup',
    status: 'done',
    priority: 5,
    tags: ['design', 'frontend'],
    subtasks: [
      { title: 'Sketch wireframe', done: true },
      { title: 'Choose colour palette', done: true },
      { title: 'Desktop breakpoints', done: true }
    ],
    description: 'Focus on dark-mode-first approach',
    dueDate: new Date('2026-02-15T17:00:00Z'),     // optional field present
    createdAt: new Date('2026-01-11T09:00:00Z')
  });

  await db.collection('tasks').insertOne({
    ownerId: aliceId,
    projectId: webId,
    title: 'Set up CI/CD pipeline',
    status: 'in-progress',
    priority: 4,
    tags: ['devops'],
    subtasks: [],                                     // empty array — still valid
    // description intentionally absent
    // dueDate intentionally absent
    createdAt: new Date('2026-01-20T14:00:00Z')
  });

  await db.collection('tasks').insertOne({
    ownerId: aliceId,
    projectId: webId,
    title: 'Write blog migration script',
    status: 'todo',
    priority: 3,
    tags: ['backend', 'content'],
    subtasks: [
      { title: 'Export old posts', done: false },
      { title: 'Map frontmatter fields', done: false }
    ],
    createdAt: new Date('2026-01-25T11:00:00Z')
  });

  // --- Alice / Fitness project ---
  await db.collection('tasks').insertOne({
    ownerId: aliceId,
    projectId: fitnessId,
    title: 'Run 5K under 25 minutes',
    status: 'in-progress',
    priority: 5,
    tags: ['cardio', 'milestone'],
    subtasks: [
      { title: 'Week 1: 3× 2 km intervals', done: true },
      { title: 'Week 2: 5K tempo run', done: false }
    ],
    dueDate: new Date('2026-03-01T08:00:00Z'),     // optional field present
    createdAt: new Date('2026-01-03T07:00:00Z')
  });

  // --- Bob / Renovation project ---
  await db.collection('tasks').insertOne({
    ownerId: bobId,
    projectId: renoId,
    title: 'Choose kitchen countertop material',
    status: 'todo',
    priority: 4,
    tags: ['kitchen', 'materials'],
    subtasks: [],
    createdAt: new Date('2026-02-02T10:00:00Z')
  });

  await db.collection('tasks').insertOne({
    ownerId: bobId,
    projectId: renoId,
    title: 'Hire licensed electrician',
    status: 'done',
    priority: 5,
    tags: ['trades', 'bathroom'],
    subtasks: [
      { title: 'Get three quotes', done: true },
      { title: 'Check licensing board', done: true }
    ],
    description: 'Must be certified for wet areas',
    dueDate: new Date('2026-02-10T17:00:00Z'),     // optional field present
    createdAt: new Date('2026-02-01T16:00:00Z')
  });

  console.log('✅ Tasks seeded');

  // =============================================================================
  //  4. NOTES  (5 total)
  //     Some attached to projects, some standalone.
  //     Demonstrates optional projectId and schema flexibility with 'pinned'.
  // =============================================================================

  await db.collection('notes').insertOne({
    ownerId: aliceId,
    projectId: webId,                              // attached to Website project
    title: 'Homepage copy brainstorming',
    body: 'Think about: concise intro, featured projects carousel, testimonial snippet...',
    tags: ['copy', 'design'],
    pinned: true,                                  // schema flexibility — only this note is pinned
    createdAt: new Date('2026-01-12T15:30:00Z')
  });

  await db.collection('notes').insertOne({
    ownerId: aliceId,
    projectId: null,                               // standalone — no project
    title: 'Random app ideas',
    body: '1. Meal-prep timer that syncs with grocery list\n2. Plant watering reminder with weather API...',
    tags: ['ideas', 'inbox'],
    // pinned is absent — most notes won't be pinned
    createdAt: new Date('2026-01-18T21:00:00Z')
  });

  await db.collection('notes').insertOne({
    ownerId: aliceId,
    projectId: fitnessId,                          // attached to Fitness project
    title: 'Weekly meal prep routine',
    body: 'Sunday: chop veggies, cook grains, portion proteins. Keep fridge organised by day.',
    tags: ['nutrition', 'routine'],
    createdAt: new Date('2026-01-05T10:00:00Z')
  });

  await db.collection('notes').insertOne({
    ownerId: bobId,
    projectId: renoId,                             // attached to Renovation project
    title: 'Contractor contact list',
    body: 'Electrician: Sarah (555-0101)\nPlumber: Mike (555-0102)\nTiler: James (555-0103)',
    tags: ['contacts', 'trades'],
    createdAt: new Date('2026-02-03T09:00:00Z')
  });

  await db.collection('notes').insertOne({
    ownerId: bobId,
    projectId: null,                               // standalone — no project
    title: 'Books to read in 2026',
    body: '1. Project Hail Mary\n2. Tomorrow, and Tomorrow, and Tomorrow\n3. The Overstory',
    tags: ['reading', 'personal'],
    createdAt: new Date('2026-01-22T19:00:00Z')
  });

  console.log('✅ Notes seeded');

  // =============================================================================
  //  Verification summary
  // =============================================================================
  const [userCount, projectCount, taskCount, noteCount] = await Promise.all([
    db.collection('users').countDocuments(),
    db.collection('projects').countDocuments(),
    db.collection('tasks').countDocuments(),
    db.collection('notes').countDocuments()
  ]);

  console.log('\n📊 Seed summary:');
  console.log(`   users:    ${userCount}`);
  console.log(`   projects: ${projectCount}`);
  console.log(`   tasks:    ${taskCount}`);
  console.log(`   notes:    ${noteCount}`);

  // Demonstrate schema flexibility
  const pinnedNotes = await db.collection('notes').countDocuments({ pinned: true });
  const tasksWithDueDate = await db.collection('tasks').countDocuments({ dueDate: { $exists: true } });
  const standaloneNotes = await db.collection('notes').countDocuments({ projectId: null });

  console.log(`\n🔍 Schema-flexibility examples:`);
  console.log(`   Pinned notes:         ${pinnedNotes} (field only on 1 doc)`);
  console.log(`   Tasks with dueDate:   ${tasksWithDueDate}/${taskCount} (optional field)`);
  console.log(`   Standalone notes:     ${standaloneNotes}/${noteCount} (projectId is null)`);

  console.log('\n✅ Seeding complete!');
  process.exit(0);
})();