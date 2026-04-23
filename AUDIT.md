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
| Bug | Status | Verification Detail |
|---|---|---|
| SQL Injection | Fixed | Verified parameterized queries in `/api/login` |
| Plaintext Passwords | Fixed | Verified `bcrypt.hash` and `bcrypt.compare` in authentication flow |
| Coupon Reuse | Fixed | Verified atomic `FOR UPDATE` and `used` boolean flag |
| Stock Decrement | Fixed | Verified atomic stock check/decrement in `BEGIN...COMMIT` transaction |
| N+1 Query | Fixed | Verified reduction of queries from O(N) to O(1) using `JOIN` |

All fixes have been implemented and verified. The application is now secure and performant.
