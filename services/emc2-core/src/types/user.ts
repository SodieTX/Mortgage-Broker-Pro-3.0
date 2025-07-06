/**
 * User type definitions
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  organization?: string;
  createdAt: Date;
  updatedAt: Date;
}
