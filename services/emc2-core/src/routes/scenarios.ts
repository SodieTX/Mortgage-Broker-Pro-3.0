/**
 * Scenario Routes
 * 
 * RESTful API endpoints for scenario management
 */

import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/connection';
import { ScenarioService } from '../services/scenarioService';
import { CreateScenarioDTO, UpdateScenarioDTO, ScenarioStatus } from '../types/scenario';

export async function scenarioRoutes(server: FastifyInstance) {
  const db = await getDatabase();
  const scenarioService = new ScenarioService(db);
  
  // Create a new scenario
  server.post<{
    Body: CreateScenarioDTO
  }>('/scenarios', async (request, reply) => {
    try {
      const scenario = await scenarioService.createScenario(request.body);
      return reply.code(201).send(scenario);
    } catch (error) {
      request.log.error('Failed to create scenario', error);
      return reply.code(500).send({ 
        error: 'Failed to create scenario',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get a scenario by ID
  server.get<{
    Params: { id: string }
  }>('/scenarios/:id', async (request, reply) => {
    try {
      const scenario = await scenarioService.getScenario(request.params.id);
      
      if (!scenario) {
        return reply.code(404).send({ error: 'Scenario not found' });
      }
      
      return reply.send(scenario);
    } catch (error) {
      request.log.error('Failed to get scenario', error);
      return reply.code(500).send({ 
        error: 'Failed to get scenario',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Update a scenario
  server.put<{
    Params: { id: string },
    Body: UpdateScenarioDTO
  }>('/scenarios/:id', async (request, reply) => {
    try {
      const scenario = await scenarioService.updateScenario(
        request.params.id, 
        request.body
      );
      
      if (!scenario) {
        return reply.code(404).send({ error: 'Scenario not found' });
      }
      
      return reply.send(scenario);
    } catch (error) {
      request.log.error('Failed to update scenario', error);
      return reply.code(500).send({ 
        error: 'Failed to update scenario',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // List scenarios
  server.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      status?: ScenarioStatus;
    }
  }>('/scenarios', async (request, reply) => {
    try {
      const { limit, offset, status } = request.query;
      
      const result = await scenarioService.listScenarios({
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        status
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error('Failed to list scenarios', error);
      return reply.code(500).send({ 
        error: 'Failed to list scenarios',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Delete a scenario
  server.delete<{
    Params: { id: string }
  }>('/scenarios/:id', async (request, reply) => {
    try {
      const deleted = await scenarioService.deleteScenario(request.params.id);
      
      if (!deleted) {
        return reply.code(404).send({ error: 'Scenario not found' });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error('Failed to delete scenario', error);
      return reply.code(500).send({ 
        error: 'Failed to delete scenario',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
