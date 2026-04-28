import { prisma } from "../services/db.js";
import { Organization } from "@prisma/client";

export class OrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { id },
    });
  }

  async findMany(skip: number, take: number, search?: string): Promise<Organization[]> {
    const where = search ? {
      OR: [
        { id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    return prisma.organization.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  async count(search?: string): Promise<number> {
    const where = search ? {
      OR: [
        { id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    return prisma.organization.count({ where });
  }

  async upsert(id: string, name: string, admin: string): Promise<Organization> {
    return prisma.organization.upsert({
      where: { id },
      update: { name, admin },
      create: { id, name, admin },
    });
  }
}

export const organizationRepository = new OrganizationRepository();
