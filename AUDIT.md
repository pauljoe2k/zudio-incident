# Security and Performance Audit

## Profiling Table
| Endpoint | Method | Average Response Time |
|----------|--------|-----------------------|
| `/api/login` | POST | 15ms |
| `/api/register` | POST | 18ms |
| `/api/apply-coupon` | POST | 20ms |
| `/api/checkout` | POST | 25ms |
| `/api/orders` | GET | 120ms (N+1 observed) |

## Bugs Identified
1. **[BUG] SQL Injection**: `/api/login` uses string concatenation instead of parameterized queries.
2. **[BUG] Plaintext Passwords**: `/api/register` stores passwords without hashing.
3. **[BUG] Coupon Reuse Bug**: `/api/apply-coupon` does not mark the coupon as used, allowing double usage.
4. **[BUG] Stock Decrement Bug**: `/api/checkout` updates stock without checking if it drops below zero atomically.
5. **[BUG] N+1 Query**: `/api/orders` runs a separate query for each user and product instead of using JOINs.

## Verification
(Pending fixes)
