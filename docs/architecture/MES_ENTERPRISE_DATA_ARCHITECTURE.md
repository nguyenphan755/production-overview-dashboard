# Enterprise MES Data Architecture: Production Orders & Master Data Management

## Executive Summary

This document provides architectural guidance for managing production order data and master data in an enterprise-scale Manufacturing Execution System (MES). It addresses the challenge of maintaining data consistency, performance, and governance across multiple databases and distributed systems.

---

## 1. Production Order Fields: Business Keys vs. Denormalized Descriptions

### 1.1 The Core Question

**Should `name` and `product_name` columns store:**
- **Option A**: Business keys (numeric IDs) - normalized approach
- **Option B**: Human-readable descriptions - denormalized approach
- **Option C**: Hybrid approach - both keys and descriptions

### 1.2 Enterprise MES Recommendation: **Hybrid Approach (Option C)**

#### Recommended Schema Design

```
production_orders table:
├── id (PK) - Technical identifier
├── order_number (Business Key) - Numeric ID from scanning system
├── order_name (Display Name) - Human-readable for UI/reporting
├── product_id (FK) - Reference to master data
├── product_code (Business Key) - Denormalized for performance
├── product_name (Display) - Denormalized for reporting
├── material_id (FK) - Reference to master data
├── material_code (Business Key) - Denormalized
├── material_description (Display) - Denormalized
└── last_synced_at - Timestamp for master data sync
```

#### Rationale

1. **Business Keys (IDs)**: 
   - Maintain referential integrity
   - Enable joins to master data for detailed information
   - Support data governance and audit trails
   - Essential for cross-system integration

2. **Denormalized Descriptions**:
   - Improve query performance (no joins required for common reports)
   - Support offline/mobile scenarios
   - Enable faster dashboard rendering
   - Reduce load on master data systems

3. **Hybrid Benefits**:
   - Best of both worlds: integrity + performance
   - Allows gradual master data updates without breaking existing records
   - Supports both transactional and analytical workloads

### 1.3 Implementation Strategy

#### At Order Creation (QR Code Scan)
```
1. Scan QR code → Extract numeric ID
2. Store: order_number = scanned_id
3. Lookup master data (local cache or API)
4. Store: product_code, product_name, material_code, material_description
5. Store: product_id, material_id (for referential integrity)
6. Store: last_synced_at = current_timestamp
```

#### Master Data Update Process
```
1. Master data changes in central system
2. Event/notification sent to MES systems
3. Update denormalized fields in production_orders
4. Update last_synced_at timestamp
5. Maintain audit log of changes
```

---

## 2. Master Data Management (MDM) Strategy

### 2.1 Single Source of Truth (SSOT) Architecture

#### Recommended Pattern: **Hub-and-Spoke Model**

```
                    ┌─────────────────────┐
                    │  Master Data Hub    │
                    │  (Central System)   │
                    │  - Products         │
                    │  - Materials        │
                    │  - Customers        │
                    │  - Specifications   │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
        │  MES Plant A │ │ MES Plant B│ │  ERP/PLM  │
        │  (Replica)   │ │ (Replica)  │ │  Systems  │
        └──────────────┘ └────────────┘ └────────────┘
```

### 2.2 Master Data Governance Principles

#### 2.2.1 Data Ownership
- **Central System**: Authoritative source for all master data
- **MES Systems**: Read replicas with denormalized copies
- **Update Authority**: Only central system can modify master data
- **Validation Rules**: Enforced at central system, propagated to MES

#### 2.2.2 Data Lifecycle
1. **Create**: Central system creates master data record
2. **Distribute**: Replicated to all MES systems
3. **Update**: Changes flow from central → MES systems
4. **Archive**: Soft delete with historical preservation
5. **Audit**: All changes tracked with timestamps and user info

#### 2.2.3 Data Quality Standards
- **Completeness**: All required fields must be populated
- **Consistency**: Same data structure across all systems
- **Accuracy**: Regular validation against business rules
- **Timeliness**: Updates propagated within defined SLA (e.g., < 5 minutes)
- **Uniqueness**: Business keys must be unique across all systems

### 2.3 Master Data Synchronization Strategies

#### Strategy 1: Event-Driven Replication (Recommended for Real-Time)

**Architecture**:
```
Central System → Message Queue (Kafka/RabbitMQ) → MES Systems
```

**Benefits**:
- Near real-time updates
- Decoupled systems
- Scalable to many subscribers
- Event sourcing capabilities

**Use Cases**:
- Product specification changes
- Material property updates
- Customer information changes

#### Strategy 2: Scheduled Batch Synchronization

**Architecture**:
```
Central System → ETL Process → MES Systems (Nightly/Hourly)
```

**Benefits**:
- Predictable load patterns
- Easier error handling
- Cost-effective for large datasets
- Supports full data refresh

**Use Cases**:
- Historical data backfill
- Bulk updates
- Reference data that changes infrequently

#### Strategy 3: API-Based On-Demand Lookup

**Architecture**:
```
MES System → API Gateway → Central System (REST/GraphQL)
```

**Benefits**:
- Always current data
- No local storage required
- Centralized business logic

**Drawbacks**:
- Network dependency
- Latency for each lookup
- Higher load on central system

**Use Cases**:
- Rarely accessed data
- Complex queries requiring business logic
- Validation during order creation

#### Strategy 4: Hybrid Approach (Recommended)

**Combination of all three**:
- **Event-driven**: For critical, frequently-changing data
- **Scheduled batch**: For large reference datasets
- **API lookup**: For validation and rare queries

---

## 3. Cross-Database Synchronization Patterns

### 3.1 Multi-Plant MES Architecture

#### Recommended Pattern: **Federated Database with Local Replicas**

```
┌─────────────────────────────────────────────────────────┐
│              Central MES Hub (PostgreSQL)              │
│  - Master production orders                            │
│  - Cross-plant analytics                               │
│  - Master data reference                               │
└───────────────────┬───────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼───┐ ┌─────▼─────┐ ┌──▼──────┐
│ Plant A   │ │ Plant B    │ │ Plant C │
│ MES DB    │ │ MES DB     │ │ MES DB  │
│ (Local)   │ │ (Local)    │ │ (Local) │
└───────────┘ └───────────┘ └─────────┘
```

### 3.2 Synchronization Mechanisms

#### 3.2.1 Change Data Capture (CDC)

**Technology Options**:
- PostgreSQL: Logical replication, pg_logical
- Database triggers → message queue
- Debezium (Kafka Connect)

**Benefits**:
- Real-time synchronization
- Low latency
- Automatic change detection
- Minimal application code changes

**Implementation**:
```
Source DB → CDC Tool → Message Queue → Target DBs
```

#### 3.2.2 Database Replication

**Types**:
- **Streaming Replication**: Real-time WAL replication (PostgreSQL)
- **Logical Replication**: Table-level replication
- **Read Replicas**: For reporting/analytics workloads

**Use Cases**:
- High availability
- Geographic distribution
- Read scaling

#### 3.2.3 Application-Level Synchronization

**Pattern**: Event Sourcing + CQRS
- Write to central system
- Events published to message queue
- Local systems subscribe and update local replicas

**Benefits**:
- Business logic in application layer
- Flexible transformation
- Audit trail built-in

### 3.3 Conflict Resolution Strategies

#### 3.3.1 Last-Write-Wins (LWW)
- Simple but can lose data
- Use for non-critical updates
- Requires reliable timestamps

#### 3.3.2 Central Authority
- Central system is always authoritative
- Local changes must be approved
- Use for critical business data

#### 3.3.3 Version Vectors
- Track version numbers
- Merge compatible changes
- Use for collaborative editing scenarios

#### 3.3.4 Business Rules
- Domain-specific conflict resolution
- Example: Production orders can't be modified after completion
- Most appropriate for MES systems

---

## 4. Balancing Normalization, Performance, and Usability

### 4.1 Data Modeling Trade-offs

#### Fully Normalized (3NF+)
**Pros**:
- No data redundancy
- Single source of truth
- Easy to maintain consistency
- Minimal storage

**Cons**:
- Many joins for common queries
- Slower read performance
- Complex queries
- Higher database load

#### Denormalized
**Pros**:
- Fast reads (no joins)
- Simple queries
- Better for analytics
- Supports offline scenarios

**Cons**:
- Data redundancy
- Update complexity
- Storage overhead
- Risk of inconsistency

#### Hybrid (Recommended)
**Pros**:
- Balance of both approaches
- Flexibility for different use cases
- Can optimize per query pattern

**Cons**:
- More complex schema
- Requires careful design
- More maintenance overhead

### 4.2 Performance Optimization Strategies

#### 4.2.1 Read Optimization
- **Materialized Views**: Pre-computed aggregations
- **Read Replicas**: Scale read operations
- **Caching**: Redis/Memcached for frequently accessed data
- **Denormalization**: Strategic denormalization for hot paths

#### 4.2.2 Write Optimization
- **Batch Inserts**: Group multiple inserts
- **Async Processing**: Non-critical updates async
- **Partitioning**: Time-based or range partitioning
- **Indexing**: Strategic indexes on foreign keys and query patterns

#### 4.2.3 Query Optimization
- **Query Patterns**: Design schema for actual query patterns
- **Composite Indexes**: Multi-column indexes for common filters
- **Partial Indexes**: Indexes on filtered subsets
- **Query Caching**: Cache expensive query results

### 4.3 Reporting and Analytics Considerations

#### 4.3.1 Operational Reporting (MES Dashboard)
- **Requirement**: Real-time, fast queries
- **Strategy**: Denormalized data in operational database
- **Data Freshness**: Near real-time (seconds to minutes)

#### 4.3.2 Business Intelligence (BI)
- **Requirement**: Historical analysis, aggregations
- **Strategy**: Data warehouse with star/snowflake schema
- **Data Freshness**: ETL from operational DB (hourly/daily)

#### 4.3.3 Data Lake (Advanced Analytics)
- **Requirement**: Raw data, machine learning
- **Strategy**: Store all events, raw data
- **Data Freshness**: Streaming or batch ingestion

### 4.4 Recommended Schema Design for Production Orders

```sql
-- Normalized core (for integrity)
production_orders (
    id UUID PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,  -- Business key
    product_id UUID REFERENCES products(id),
    material_id UUID REFERENCES materials(id),
    customer_id UUID REFERENCES customers(id),
    ...
)

-- Denormalized for performance (updated via sync)
production_orders (
    ...
    product_code VARCHAR(50),           -- From products table
    product_name VARCHAR(255),          -- From products table
    material_code VARCHAR(50),           -- From materials table
    material_description TEXT,         -- From materials table
    customer_code VARCHAR(50),           -- From customers table
    customer_name VARCHAR(255),          -- From customers table
    last_master_data_sync TIMESTAMP,     -- Track sync time
    ...
)

-- Master data reference (read replica)
products (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,   -- Business key
    name VARCHAR(255),
    description TEXT,
    specifications JSONB,
    ...
)
```

---

## 5. Data Governance and Long-Term Maintainability

### 5.1 Data Governance Framework

#### 5.1.1 Data Stewardship
- **Data Owners**: Business units responsible for data quality
- **Data Stewards**: Technical teams managing data systems
- **Data Consumers**: Teams using the data (MES operators, analysts)

#### 5.1.2 Data Quality Metrics
- **Completeness**: % of required fields populated
- **Accuracy**: Validation against business rules
- **Consistency**: Cross-system data alignment
- **Timeliness**: Data freshness metrics
- **Uniqueness**: Duplicate detection

#### 5.1.3 Data Lineage
- Track data flow: Source → Transformations → Destination
- Document business rules and transformations
- Maintain audit trails for compliance

### 5.2 Long-Term Maintainability

#### 5.2.1 Schema Evolution
- **Versioning**: Track schema versions
- **Migration Strategy**: Backward-compatible changes
- **Deprecation Policy**: Clear deprecation timeline
- **Documentation**: Keep schema documentation current

#### 5.2.2 Technology Choices
- **Standard SQL**: Avoid vendor-specific features where possible
- **Open Standards**: Use industry standards (ISO, ISA-95)
- **Abstraction Layers**: API layers hide implementation details
- **Modularity**: Separate concerns (operational vs. analytical)

#### 5.2.3 Monitoring and Observability
- **Data Quality Monitoring**: Automated checks
- **Sync Status**: Monitor replication lag
- **Performance Metrics**: Query performance tracking
- **Error Tracking**: Failed syncs, data quality issues

### 5.3 Compliance and Audit Requirements

#### 5.3.1 Audit Trails
- **Change Tracking**: Who changed what, when, why
- **Data Retention**: Regulatory requirements
- **Immutable Logs**: Append-only audit logs
- **Access Logging**: Who accessed what data

#### 5.3.2 Data Privacy
- **PII Handling**: Personal identifiable information
- **Data Masking**: Sensitive data in non-production
- **Access Controls**: Role-based access (RBAC)
- **Encryption**: At rest and in transit

---

## 6. Shop Floor Workflow: QR Code Scan to MES Integration

### 6.1 Shop Floor Perspective: Post-Scan Workflow

#### Step-by-Step Process After QR Code Scan

```
┌─────────────────────────────────────────────────────────────┐
│  SHOP FLOOR WORKFLOW: QR Code Scan → MES Integration        │
└─────────────────────────────────────────────────────────────┘

1. OPERATOR SCANS QR CODE
   ├── Mobile device captures QR code
   ├── Extracts: Production Order Number (numeric ID)
   └── Extracts: Production Description (if encoded in QR)

2. DATA VALIDATION (Mobile App)
   ├── Validate QR code format
   ├── Check if order number exists in master data
   └── Verify order is valid for current plant/line

3. WRITE TO SCANNING DATABASE (PostgreSQL)
   ├── Insert into scanning_db.production_orders
   ├── Store: order_number (scanned numeric ID)
   ├── Store: raw_description (from QR code, if available)
   ├── Store: scan_timestamp
   ├── Store: operator_id, device_id, location
   └── Status: 'scanned' or 'pending_enrichment'

4. MASTER DATA ENRICHMENT (Immediate)
   ├── Lookup order_number in master data (local cache or API)
   ├── Retrieve: product_code, product_name, material_code, etc.
   ├── Update scanning_db.production_orders with enriched data
   └── Status: 'enriched' or 'enrichment_failed'

5. PUSH TO MES DATABASE (Recommended Method: Event-Driven CDC)
   ├── Change detected in scanning_db.production_orders
   ├── Event published to message queue
   ├── MES system consumes event
   ├── Enrich with additional MES context (machine_id, area, etc.)
   └── Insert/update in mes_db.production_orders

6. MES PROCESSING
   ├── Order appears in MES dashboard
   ├── Available for production scheduling
   ├── Can be assigned to machines/lines
   └── Status: 'ready' or 'scheduled'
```

### 6.2 Recommended Method: Change Data Capture (CDC) with Event Streaming

#### Why CDC is Recommended for Shop Floor Integration

**From Shop Floor Perspective**:
- ✅ **Real-time**: Orders appear in MES within seconds
- ✅ **Reliable**: Automatic retry on failures
- ✅ **Non-blocking**: Mobile app doesn't wait for MES sync
- ✅ **Auditable**: Complete change history
- ✅ **Resilient**: Handles network interruptions gracefully

#### Architecture: CDC Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│  SCANNING DATABASE (PostgreSQL)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ production_orders                                    │   │
│  │ ├── order_number (scanned from QR)                   │   │
│  │ ├── raw_description                                  │   │
│  │ ├── scan_timestamp                                    │   │
│  │ ├── enriched_data (from master data lookup)          │   │
│  │ └── status: 'scanned' → 'enriched' → 'synced'        │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ CDC Tool (Debezium/pg_logical)
                        │ Detects INSERT/UPDATE
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  MESSAGE QUEUE (Kafka/RabbitMQ)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Topic: production_orders.scanned                     │   │
│  │ Event: { order_number, description, timestamp, ... } │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ Event Consumer (MES Service)
                        │ Enriches with MES context
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  MES DATABASE (PostgreSQL)                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ production_orders                                    │   │
│  │ ├── order_number (from scan)                        │   │
│  │ ├── order_name (from master data)                   │   │
│  │ ├── product_code, product_name (enriched)           │   │
│  │ ├── machine_id (assigned later)                     │   │
│  │ ├── area (assigned later)                          │   │
│  │ ├── status: 'ready' → 'scheduled' → 'running'      │   │
│  │ └── synced_from_scanning_db_at                      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Implementation Details: CDC Method

#### Option A: PostgreSQL Logical Replication (Native)

**Technology**: PostgreSQL pg_logical extension

**Setup**:
```sql
-- On scanning database
CREATE PUBLICATION production_orders_pub 
FOR TABLE production_orders;

-- On MES database (subscriber)
CREATE SUBSCRIPTION production_orders_sub
CONNECTION 'host=scanning_db hostname...'
PUBLICATION production_orders_pub;
```

**Pros**:
- Native PostgreSQL feature
- Low overhead
- Automatic conflict detection
- Built-in retry mechanism

**Cons**:
- Direct database-to-database connection required
- Less flexible for transformations
- Limited to PostgreSQL

#### Option B: Debezium (Kafka Connect) - **RECOMMENDED**

**Technology**: Debezium PostgreSQL Connector + Apache Kafka

**Architecture**:
```
Scanning DB → Debezium Connector → Kafka → MES Consumer → MES DB
```

**Pros**:
- Industry-standard CDC solution
- Supports transformations
- Scalable (multiple consumers)
- Event replay capability
- Works with any database
- Built-in monitoring

**Cons**:
- Requires Kafka infrastructure
- More complex setup
- Additional components to manage

**Why Recommended**:
- ✅ Handles high-volume shop floor scanning
- ✅ Supports multiple MES systems consuming same events
- ✅ Can add business logic/transformations
- ✅ Event replay for recovery
- ✅ Monitoring and observability

#### Option C: Application-Level Event Publishing

**Technology**: Database triggers + Message Queue

**Setup**:
```sql
-- Trigger on scanning database
CREATE TRIGGER production_order_sync_trigger
AFTER INSERT OR UPDATE ON production_orders
FOR EACH ROW
EXECUTE FUNCTION publish_to_message_queue();
```

**Pros**:
- Full control over event format
- Can add business logic
- Works with any message queue

**Cons**:
- Requires custom code
- More maintenance
- Potential performance impact on scanning DB

### 6.4 Complete Workflow: From Scan to MES

#### Phase 1: QR Code Scan (Mobile App)

```
1. Operator scans QR code
   └── Extracts: "PO-2024-156" (order number)

2. Mobile app validates
   ├── Check format: Valid order number pattern
   └── Check existence: Query master data cache/API

3. Write to scanning database
   INSERT INTO scanning_db.production_orders (
     order_number,           -- 'PO-2024-156'
     raw_description,         -- From QR (if available)
     scan_timestamp,         -- NOW()
     operator_id,            -- Current operator
     device_id,              -- Mobile device ID
     location,               -- Shop floor location
     status                  -- 'scanned'
   );
```

#### Phase 2: Master Data Enrichment (Immediate)

```
4. Enrichment service (runs immediately after insert)
   ├── Lookup order_number in master data
   │   └── Query: SELECT * FROM master_data.orders 
   │              WHERE order_number = 'PO-2024-156'
   │
   ├── Retrieve enriched data:
   │   ├── product_code: 'CV-3x2.5mm²'
   │   ├── product_name: 'Cable CV 3x2.5mm²'
   │   ├── material_code: 'MAT-001'
   │   ├── material_description: 'Copper wire 2.5mm²'
   │   ├── customer_code: 'CUST-ABC'
   │   └── customer_name: 'Customer ABC'
   │
   └── Update scanning database
       UPDATE scanning_db.production_orders
       SET 
         product_code = 'CV-3x2.5mm²',
         product_name = 'Cable CV 3x2.5mm²',
         material_code = 'MAT-001',
         material_description = 'Copper wire 2.5mm²',
         customer_code = 'CUST-ABC',
         customer_name = 'Customer ABC',
         status = 'enriched',
         enriched_at = NOW()
       WHERE order_number = 'PO-2024-156';
```

#### Phase 3: Push to MES (CDC Event)

```
5. CDC detects change (Debezium/Logical Replication)
   └── Change event created:
       {
         "event_type": "UPDATE",
         "table": "production_orders",
         "order_number": "PO-2024-156",
         "status": "enriched",
         "product_code": "CV-3x2.5mm²",
         "product_name": "Cable CV 3x2.5mm²",
         "timestamp": "2024-01-15T10:30:00Z"
       }

6. Event published to Kafka
   └── Topic: production_orders.enriched
       Partition: Based on order_number hash
       Key: order_number (for ordering)

7. MES consumer processes event
   ├── Receive event from Kafka
   ├── Validate data completeness
   ├── Add MES-specific context:
   │   ├── plant_id (from configuration)
   │   ├── default_area (from product type)
   │   └── priority (from business rules)
   │
   └── Insert/Update MES database
       INSERT INTO mes_db.production_orders (
         order_number,           -- 'PO-2024-156'
         order_name,             -- 'PO-2024-156' (or from master data)
         product_code,            -- 'CV-3x2.5mm²'
         product_name,           -- 'Cable CV 3x2.5mm²'
         material_code,          -- 'MAT-001'
         material_description,    -- 'Copper wire 2.5mm²'
         customer_code,           -- 'CUST-ABC'
         customer_name,           -- 'Customer ABC'
         plant_id,                -- 'PLANT-01'
         status,                  -- 'ready'
         synced_from_scanning_db_at, -- NOW()
         created_at               -- NOW()
       )
       ON CONFLICT (order_number) 
       DO UPDATE SET
         product_code = EXCLUDED.product_code,
         product_name = EXCLUDED.product_name,
         status = EXCLUDED.status,
         synced_from_scanning_db_at = NOW();
```

#### Phase 4: MES Processing

```
8. Order appears in MES dashboard
   └── Status: 'ready' (available for scheduling)

9. Production scheduler assigns order
   ├── Assign to machine/line
   ├── Set target_length, target_speed
   └── Update status: 'scheduled' → 'running'

10. Shop floor execution
    └── Order tracked in real-time production dashboard
```

### 6.5 Error Handling and Resilience

#### Failure Scenarios

**Scenario 1: Master Data Lookup Fails**
```
Action: Store order with status='enrichment_failed'
Retry: Background job retries enrichment every 5 minutes
Fallback: Manual enrichment via admin interface
```

**Scenario 2: CDC Event Fails**
```
Action: Event remains in Kafka (not committed)
Retry: Consumer automatically retries (exponential backoff)
Dead Letter Queue: After N retries, send to DLQ for manual review
```

**Scenario 3: MES Database Unavailable**
```
Action: Events accumulate in Kafka
Recovery: When MES DB recovers, consumer processes backlog
Monitoring: Alert on consumer lag
```

**Scenario 4: Network Interruption**
```
Action: Mobile app queues scan locally
Recovery: When network restored, sync queued scans
Offline Mode: Mobile app works offline, syncs when online
```

### 6.6 Performance Considerations

#### Latency Targets (Shop Floor Requirements)

- **QR Scan to Scanning DB**: < 100ms (local write)
- **Master Data Enrichment**: < 500ms (cache lookup) or < 2s (API call)
- **CDC Event Generation**: < 1s (near real-time)
- **Kafka Event Delivery**: < 500ms (local network)
- **MES Consumer Processing**: < 2s (including DB write)
- **Total End-to-End**: < 5 seconds (from scan to MES visibility)

#### Throughput Requirements

- **Peak Scanning Rate**: 100-500 orders/minute (depends on shop floor size)
- **CDC Events**: Must handle burst traffic
- **Kafka**: Scale partitions based on throughput
- **MES Consumer**: Scale horizontally (multiple consumer instances)

### 6.7 Monitoring and Observability

#### Key Metrics to Monitor

1. **Scanning Database**:
   - Orders scanned per minute
   - Enrichment success rate
   - Enrichment latency

2. **CDC Pipeline**:
   - Events generated per minute
   - CDC lag (time between DB change and event)
   - Failed events count

3. **Kafka**:
   - Message throughput
   - Consumer lag
   - Topic partition health

4. **MES Consumer**:
   - Processing rate
   - Error rate
   - Processing latency

5. **MES Database**:
   - Orders synced per minute
   - Sync lag (time from scan to MES)
   - Failed syncs count

#### Dashboards

- **Real-time**: Current scanning rate, sync status
- **Operational**: Last 24 hours metrics, error rates
- **Business**: Orders by status, enrichment success rate

---

## 7. Recommended Architecture for Your Scenario

### 7.1 Current State Analysis

**Your Current Setup**:
- QR code scanning → Separate database
- Numeric IDs stored in production_orders
- Master data in centralized reference table
- Need to integrate with core MES database

### 7.2 Recommended Target Architecture

#### Phase 1: Immediate (Hybrid Approach)
```
production_orders:
├── order_number (VARCHAR) - Scanned numeric ID (business key)
├── order_name (VARCHAR) - Display name (from master data lookup)
├── product_id (UUID FK) - Reference to products table
├── product_code (VARCHAR) - Denormalized for performance
├── product_name (VARCHAR) - Denormalized for UI
├── material_id (UUID FK) - Reference to materials table
├── material_code (VARCHAR) - Denormalized
├── material_description (TEXT) - Denormalized
└── last_master_data_sync (TIMESTAMP) - Track sync time
```

#### Phase 2: Shop Floor Integration (CDC Method)

**Recommended**: Debezium + Kafka for production_orders sync

**Why**:
- Handles high-volume shop floor scanning
- Real-time sync (< 5 seconds end-to-end)
- Resilient to failures
- Supports multiple MES consumers
- Event replay for recovery

**Implementation**:
1. Set up Debezium PostgreSQL connector
2. Configure Kafka topics for production_orders
3. Build MES consumer service
4. Implement enrichment logic
5. Set up monitoring and alerting

#### Phase 3: Master Data Synchronization
1. **Event-Driven Updates**: When master data changes, publish events
2. **Batch Sync**: Nightly full sync for consistency check
3. **API Lookup**: On-demand lookup during order creation
4. **Local Cache**: Redis cache for frequently accessed master data

#### Phase 4: Multi-Database Integration
1. **CDC from Scanning DB**: Capture changes from scanning database
2. **Replicate to MES DB**: Stream changes to core MES database
3. **Master Data Enrichment**: Enrich with master data during replication
4. **Conflict Resolution**: Business rules for handling conflicts

### 7.3 Implementation Roadmap

#### Step 1: Schema Enhancement (Week 1-2)
- Add denormalized fields to production_orders
- Add foreign key references
- Add sync timestamp fields
- Create indexes for performance

#### Step 2: CDC Pipeline Setup (Week 3-4)
- Set up Debezium connector for scanning database
- Configure Kafka topics and partitions
- Build MES consumer service
- Implement error handling and retry logic
- Set up monitoring dashboards

#### Step 3: Master Data Sync (Week 5-6)
- Implement event-driven sync mechanism
- Set up scheduled batch sync
- Create API for on-demand lookup
- Implement local caching layer

#### Step 4: Cross-Database Integration (Week 7-10)
- Set up CDC from scanning database
- Implement replication to MES database
- Add master data enrichment pipeline
- Implement conflict resolution logic

#### Step 5: Monitoring & Governance (Week 11-12)
- Set up data quality monitoring
- Implement audit logging
- Create dashboards for sync status
- Document data lineage

---

## 8. Key Recommendations Summary

### 8.1 Shop Floor Integration Method

✅ **Use CDC (Change Data Capture)**: Debezium + Kafka for real-time sync
✅ **Event-Driven**: Orders flow automatically from scanning DB to MES
✅ **Resilient**: Handles failures gracefully with retry mechanisms
✅ **Scalable**: Supports high-volume shop floor scanning
✅ **Observable**: Full monitoring and alerting capabilities

### 8.2 Data Storage Strategy
✅ **Store both**: Business keys (for integrity) + Denormalized descriptions (for performance)
✅ **Maintain foreign keys**: For referential integrity
✅ **Track sync timestamps**: Know when data was last updated

### 8.3 Master Data Management
✅ **Single source of truth**: Central system owns master data
✅ **Replicate to MES**: Local replicas for performance
✅ **Event-driven sync**: Real-time updates for critical changes
✅ **Batch sync**: Scheduled sync for consistency

### 8.4 Cross-Database Synchronization
✅ **CDC for real-time**: Change Data Capture for low latency
✅ **API for validation**: On-demand lookup for rare cases
✅ **Hybrid approach**: Combine multiple sync strategies
✅ **Conflict resolution**: Business rules for handling conflicts

### 8.5 Performance & Maintainability
✅ **Strategic denormalization**: Denormalize hot paths only
✅ **Materialized views**: For complex aggregations
✅ **Caching layer**: Redis for frequently accessed data
✅ **Monitoring**: Track data quality and sync status

---

## 9. Industry Standards and Best Practices

### 9.1 ISA-95 (Enterprise-Control System Integration)
- **Level 3**: MES layer - production orders, work orders
- **Level 4**: ERP layer - master data, planning
- **Separation of concerns**: Clear boundaries between levels

### 9.2 Data Architecture Patterns
- **CQRS**: Command Query Responsibility Segregation
- **Event Sourcing**: Store events, derive state
- **Domain-Driven Design**: Bounded contexts for different domains

### 9.3 Scalability Patterns
- **Horizontal scaling**: Read replicas, sharding
- **Caching strategies**: Multi-level caching
- **Async processing**: Non-blocking operations

---

## 10. Discussion Points

### Questions to Consider:

1. **Data Freshness Requirements**:
   - How real-time must master data updates be?
   - What's acceptable sync lag for your use case?

2. **Network Reliability**:
   - What happens when central system is unavailable?
   - Do you need offline capability?

3. **Data Volume**:
   - How many production orders per day?
   - How large is master data catalog?

4. **Multi-Plant Considerations**:
   - Do plants share master data or have plant-specific data?
   - How do you handle plant-specific customizations?

5. **Compliance Requirements**:
   - What audit requirements exist?
   - What data retention policies apply?

6. **Performance SLAs**:
   - What are acceptable query response times?
   - What's the peak load scenario?

---

## 11. References and Further Reading

- **ISA-95 Standard**: Enterprise-Control System Integration
- **Data Mesh**: Federated data architecture
- **Event-Driven Architecture**: Microservices patterns
- **Master Data Management**: MDM best practices
- **PostgreSQL Replication**: Logical replication patterns

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Discussion Draft  
**Next Review**: After stakeholder feedback

