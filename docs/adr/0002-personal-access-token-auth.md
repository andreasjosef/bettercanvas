# Personal Access Token instead of OAuth2

Better Canvas authenticates to Canvas with a user-generated Personal Access
Token pasted in on first connect, not OAuth2. Canvas supports both, but
OAuth2 requires registering a developer key with the school's Canvas
admin — a dependency outside the user's control, and pure overhead for an
app with exactly one user. A Personal Access Token needs no admin
involvement and can be generated and revoked entirely by the user. This is
specific to the single-user, single-instance shape of v1; multi-tenant
support (out of scope for v1) would likely need to revisit this.
