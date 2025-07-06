/**
 * Scenario Service
 * 
 * Core business logic for creating and managing scenarios
 */

import { Pool } from 'pg';
import { CreateScenarioDTO, UpdateScenarioDTO, Scenario, ScenarioStatus } from '../types/scenario';
import { logger } from '../utils/logger';

export class ScenarioService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Create a new scenario
   */
  async createScenario(data: CreateScenarioDTO): Promise<Scenario> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create the scenario
      const result = await client.query(
        `INSERT INTO core.scenarios (external_id, title, description, loan_data, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.externalId || null,
          data.title,
          data.description || null,
          JSON.stringify(data.loanData || {}),
          data.createdBy || null
        ]
      );

      const scenario = this.mapRowToScenario(result.rows[0]);
      
      // Log the creation event
      await client.query(
        `SELECT core.log_scenario_event($1, $2, $3, $4)`,
        [scenario.id, 'created', JSON.stringify({ title: data.title }), data.createdBy]
      );
      
      await client.query('COMMIT');
      
      logger.info('Scenario created successfully', { scenarioId: scenario.id });
      return scenario;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create scenario', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a scenario by ID
   */
  async getScenario(id: string): Promise<Scenario | null> {
    const result = await this.db.query(
      'SELECT * FROM core.scenarios WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToScenario(result.rows[0]);
  }

  /**
   * Update a scenario
   */
  async updateScenario(id: string, data: UpdateScenarioDTO): Promise<Scenario | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (data.title !== undefined) {
        updates.push(`title = $${paramCount}`);
        values.push(data.title);
        paramCount++;
      }
      
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount}`);
        values.push(data.description);
        paramCount++;
      }
      
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount}`);
        values.push(data.status);
        paramCount++;
      }
      
      if (data.loanData !== undefined) {
        updates.push(`loan_data = $${paramCount}`);
        values.push(JSON.stringify(data.loanData));
        paramCount++;
      }
      
      if (data.updatedBy !== undefined) {
        updates.push(`updated_by = $${paramCount}`);
        values.push(data.updatedBy);
        paramCount++;
      }
      
      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return await this.getScenario(id);
      }
      
      // Add ID as the last parameter
      values.push(id);
      
      const result = await client.query(
        `UPDATE core.scenarios 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount} AND deleted_at IS NULL
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      
      const scenario = this.mapRowToScenario(result.rows[0]);
      
      // Log the update event
      await client.query(
        `SELECT core.log_scenario_event($1, $2, $3, $4)`,
        [scenario.id, 'updated', JSON.stringify(data), data.updatedBy]
      );
      
      await client.query('COMMIT');
      
      logger.info('Scenario updated successfully', { scenarioId: scenario.id });
      return scenario;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update scenario', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List scenarios with pagination
   */
  async listScenarios(options: {
    limit?: number;
    offset?: number;
    status?: ScenarioStatus;
  } = {}): Promise<{ scenarios: Scenario[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    let whereClause = 'WHERE deleted_at IS NULL';
    const values: any[] = [];
    
    if (options.status) {
      values.push(options.status);
      whereClause += ` AND status = $${values.length}`;
    }
    
    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM core.scenarios ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    // Get scenarios
    values.push(limit, offset);
    const result = await this.db.query(
      `SELECT * FROM core.scenarios 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    
    const scenarios = result.rows.map(row => this.mapRowToScenario(row));
    
    return { scenarios, total };
  }

  /**
   * Delete a scenario (soft delete)
   */
  async deleteScenario(id: string, deletedBy?: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE core.scenarios 
         SET deleted_at = CURRENT_TIMESTAMP, updated_by = $2
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [id, deletedBy]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      // Log the deletion event
      await client.query(
        `SELECT core.log_scenario_event($1, $2, $3, $4)`,
        [id, 'deleted', '{}', deletedBy]
      );
      
      await client.query('COMMIT');
      
      logger.info('Scenario deleted successfully', { scenarioId: id });
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete scenario', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper to map database row to Scenario type
   */
  private mapRowToScenario(row: any): Scenario {
    return {
      id: row.id,
      externalId: row.external_id,
      title: row.title,
      description: row.description,
      status: row.status,
      loanData: row.loan_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at
    };
  }
}

