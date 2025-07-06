#!/usr/bin/env node
/**
 * Observability Stack Management
 * 
 * Start/stop the local observability stack
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DOCKER_COMPOSE_PATH = path.join(__dirname, '..', 'docker', 'observability');
const DOCKER_COMPOSE_FILE = path.join(DOCKER_COMPOSE_PATH, 'docker-compose.yml');

const commands = {
  start: 'Start the observability stack',
  stop: 'Stop the observability stack',
  restart: 'Restart the observability stack',
  status: 'Check status of observability services',
  logs: 'View logs from observability services',
  clean: 'Stop and remove all containers and volumes',
};

function executeCommand(command) {
  try {
    console.log(`Executing: ${command}`);
    execSync(command, { 
      stdio: 'inherit',
      cwd: DOCKER_COMPOSE_PATH 
    });
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    process.exit(1);
  }
}

function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    execSync('docker compose version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Docker or Docker Compose not found!');
    console.error('Please install Docker Desktop from https://www.docker.com/products/docker-desktop');
    process.exit(1);
  }
}

function start() {
  console.log('🚀 Starting observability stack...\n');
  
  checkDocker();
  
  if (!fs.existsSync(DOCKER_COMPOSE_FILE)) {
    console.error(`❌ Docker Compose file not found: ${DOCKER_COMPOSE_FILE}`);
    process.exit(1);
  }
  
  executeCommand('docker compose up -d');
  
  console.log('\n✅ Observability stack started!');
  console.log('\n📊 Access points:');
  console.log('  - Jaeger UI: http://localhost:16686');
  console.log('  - Prometheus: http://localhost:9090');
  console.log('  - Grafana: http://localhost:3333 (admin/admin)');
  console.log('\n💡 Configure your app to send traces to: http://localhost:4318/v1/traces');
}

function stop() {
  console.log('🛑 Stopping observability stack...\n');
  
  checkDocker();
  executeCommand('docker compose down');
  
  console.log('\n✅ Observability stack stopped!');
}

function restart() {
  console.log('🔄 Restarting observability stack...\n');
  
  stop();
  console.log('');
  start();
}

function status() {
  console.log('📊 Checking observability stack status...\n');
  
  checkDocker();
  executeCommand('docker compose ps');
}

function logs(service) {
  console.log('📝 Viewing logs...\n');
  
  checkDocker();
  
  const command = service 
    ? `docker compose logs -f ${service}`
    : 'docker compose logs -f';
    
  executeCommand(command);
}

function clean() {
  console.log('🧹 Cleaning up observability stack...\n');
  
  const response = require('readline-sync').question(
    '⚠️  This will remove all containers and volumes. Continue? (y/N): '
  );
  
  if (response.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    return;
  }
  
  checkDocker();
  executeCommand('docker compose down -v');
  
  console.log('\n✅ Observability stack cleaned up!');
}

function showUsage() {
  console.log('Observability Stack Manager\n');
  console.log('Usage: npm run observability <command> [options]\n');
  console.log('Commands:');
  
  for (const [cmd, desc] of Object.entries(commands)) {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  }
  
  console.log('\nExamples:');
  console.log('  npm run observability start');
  console.log('  npm run observability logs jaeger');
  console.log('  npm run observability status');
}

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'restart':
    restart();
    break;
  case 'status':
    status();
    break;
  case 'logs':
    logs(args[0]);
    break;
  case 'clean':
    clean();
    break;
  default:
    showUsage();
    process.exit(command ? 1 : 0);
}
