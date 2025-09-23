# Soundlink Technical Architecture

## System Overview

Soundlink is a web-based campaign analytics platform that tracks Spotify listening behavior through OAuth integration and provides detailed analytics for marketing campaigns.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Browser  │    │  Campaign Owner │    │ Spotify Web API │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ 1. Click Tracker     │ 2. Create Campaign   │ 3. OAuth Flow
          │    Link              │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Soundlink Application                        │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Frontend  │  │   Backend   │  │  Services   │            │
│  │   (HTML/JS) │  │ (Express)   │  │   Layer     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Database   │  │  Polling    │  │ Attribution │            │
│  │  (SQLite)   │  │  Service    │  │   Engine    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer

**Technology Stack:**
- Vanilla HTML/CSS/JavaScript (no frameworks)
- Chart.js for data visualization
- Progressive enhancement approach

**Responsibilities:**
- Campaign dashboard interface
- Analytics visualization
- User interaction handling
- Real-time data updates

**Key Features:**
- Responsive design for mobile/desktop
- Interactive charts and graphs
- Form validation and error handling
- AJAX-based data fetching

### 2. Backend Layer

**Technology Stack:**
- Node.js with TypeScript
- Express.js web framework
- RESTful API design

**Responsibilities:**
- HTTP request/response handling
- Route management and middleware
- Session management
- API endpoint implementation

**Key Components:**
- Route handlers (`src/routes/`)
- Middleware for authentication
- Error handling and logging
- Static file serving

### 3. Services Layer

**Technology Stack:**
- TypeScript modules
- Service-oriented architecture
- Dependency injection pattern

**Core Services:**

#### Authentication Service (`auth.ts`)
- User registration and login
- Password hashing with bcrypt
- Session management
- JWT token handling

#### Spotify Service (`spotify.ts`)
- OAuth 2.0 flow implementation
- API client for Spotify Web API
- Token refresh handling
- User profile and play data fetching

#### Attribution Service (`attribution.ts`)
- Links user plays to campaigns
- Confidence scoring algorithm
- Playlist verification logic
- Data attribution rules

#### Polling Service (`polling.ts`)
- Background data collection
- Recently played tracks fetching
- Scheduled execution
- Error handling and retries

#### Database Service (`database.ts`)
- SQLite database operations
- Connection management
- Query optimization
- Transaction handling

### 4. Data Layer

**Technology Stack:**
- SQLite database
- SQL query language
- Database migrations

**Schema Design:**
- Normalized relational structure
- Foreign key relationships
- Indexed columns for performance
- Audit trail support

## Data Flow Architecture

### 1. Campaign Creation Flow

```
Campaign Owner → Dashboard → Create Campaign → Database → Tracker Link
```

1. User accesses dashboard
2. Creates new campaign with playlist URL
3. System generates unique tracker link
4. Campaign data stored in database
5. Tracker link returned to user

### 2. User Interaction Flow

```
External User → Tracker Link → OAuth → Spotify → Play Data → Attribution
```

1. User clicks tracker link
2. System records click event
3. Redirects to Spotify OAuth
4. User authorizes application
5. System creates user session
6. Polling service collects play data
7. Attribution engine links plays to campaign

### 3. Analytics Flow

```
Campaign Owner → Dashboard → API → Database → Aggregated Data → Charts
```

1. User requests analytics
2. API queries database
3. Data aggregated by service layer
4. Formatted response sent to frontend
5. Charts updated with new data

## Security Architecture

### Authentication & Authorization

**OAuth 2.0 Flow:**
```
User → Authorization Server (Spotify) → Access Token → Resource Server
```

**Session Management:**
- Encrypted session tokens
- Secure cookie handling
- Session expiration
- Cross-site request forgery (CSRF) protection

### Data Protection

**Encryption Strategy:**
- AES-256 encryption for sensitive data
- Secure key management
- Encrypted database storage for tokens
- HTTPS for all communications

**Input Validation:**
- Server-side validation for all inputs
- SQL injection prevention
- XSS protection
- Rate limiting on API endpoints

## Performance Architecture

### Caching Strategy

**Multi-Level Caching:**
```
Request → Memory Cache → Database → External API
```

**Cache Types:**
- In-memory caching for playlist tracks
- Session caching for user data
- Query result caching
- Static asset caching

### Database Optimization

**Indexing Strategy:**
- Primary key indexes on all tables
- Foreign key indexes for JOIN operations
- Date-based indexes for time queries
- Composite indexes for complex queries

**Query Optimization:**
- Prepared statements for all queries
- Connection pooling
- Query result pagination
- Lazy loading for large datasets

### Background Processing

**Polling Architecture:**
```
Scheduler → Polling Service → Spotify API → Database → Attribution Engine
```

**Processing Strategy:**
- Asynchronous background jobs
- Batch processing for efficiency
- Error handling and retries
- Queue management for high loads

## Scalability Considerations

### Current Limitations

**SQLite Constraints:**
- Single-writer limitation
- File-based storage
- No built-in replication
- Limited concurrent connections

### Scaling Strategies

**Short-term (1-1000 users):**
- Optimize database queries
- Implement connection pooling
- Add caching layers
- Monitor resource usage

**Medium-term (1000-10000 users):**
- Migrate to PostgreSQL
- Implement read replicas
- Add load balancing
- Use Redis for caching

**Long-term (10000+ users):**
- Microservices architecture
- Container orchestration
- CDN for static assets
- Event-driven architecture

## Integration Architecture

### Spotify API Integration

**OAuth 2.0 Implementation:**
```
Client → Authorization → Token Exchange → API Calls → Token Refresh
```

**API Rate Limiting:**
- Respect Spotify's rate limits
- Implement exponential backoff
- Queue requests during high load
- Monitor API usage

**Data Synchronization:**
- Incremental data fetching
- Conflict resolution
- Data validation
- Error recovery

### External Service Integration

**Potential Integrations:**
- Analytics platforms (Google Analytics)
- Marketing tools (Mailchimp)
- Social media APIs
- Email services

**Integration Patterns:**
- Webhook-based updates
- Scheduled synchronization
- Event-driven architecture
- API gateway pattern

## Monitoring & Observability

### Logging Strategy

**Log Levels:**
- ERROR: Critical system errors
- WARN: Warning conditions
- INFO: General information
- DEBUG: Detailed debugging

**Log Aggregation:**
- Centralized logging
- Structured log format
- Log rotation
- Error tracking

### Metrics Collection

**Application Metrics:**
- Request/response times
- Error rates
- User activity
- Database performance

**System Metrics:**
- CPU and memory usage
- Disk I/O
- Network traffic
- Database connections

### Health Monitoring

**Health Checks:**
- Database connectivity
- Spotify API status
- Service availability
- Resource utilization

**Alerting:**
- Error rate thresholds
- Performance degradation
- Service downtime
- Resource exhaustion

## Error Handling Architecture

### Error Classification

**Error Types:**
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Server errors (500)

**Error Handling Flow:**
```
Error → Classification → Logging → User Response → Recovery
```

### Recovery Strategies

**Automatic Recovery:**
- Retry failed requests
- Fallback mechanisms
- Circuit breaker pattern
- Graceful degradation

**Manual Recovery:**
- Admin intervention
- Data repair tools
- System restart
- Rollback procedures

## Development Architecture

### Code Organization

**Modular Structure:**
```
src/
├── index.ts          # Application entry point
├── routes/           # HTTP route handlers
├── services/         # Business logic
├── utils/            # Utility functions
└── types/            # TypeScript type definitions
```

**Design Patterns:**
- Service-oriented architecture
- Repository pattern for data access
- Factory pattern for object creation
- Observer pattern for events

### Testing Strategy

**Test Types:**
- Unit tests for services
- Integration tests for APIs
- End-to-end tests for workflows
- Performance tests for scaling

**Testing Tools:**
- Jest for unit testing
- Supertest for API testing
- Playwright for E2E testing
- Artillery for load testing

## Deployment Architecture

### Container Strategy

**Docker Configuration:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["npm", "start"]
```

**Container Benefits:**
- Consistent environments
- Easy scaling
- Simplified deployment
- Resource isolation

### CI/CD Pipeline

**Pipeline Stages:**
```
Code → Build → Test → Deploy → Monitor
```

**Automation:**
- Automated testing
- Code quality checks
- Security scanning
- Deployment automation

## Future Architecture Considerations

### Technology Evolution

**Potential Upgrades:**
- TypeScript to latest version
- Node.js to latest LTS
- Database migration to PostgreSQL
- Frontend framework adoption

### Feature Enhancements

**Planned Features:**
- Real-time WebSocket updates
- Advanced analytics
- Multi-platform support
- API versioning

### Performance Improvements

**Optimization Areas:**
- Database query optimization
- Caching strategy enhancement
- Background job optimization
- Frontend performance tuning

---

**Architecture Version**: 1.0  
**Last Updated**: January 2025  
**Review Schedule**: Quarterly
