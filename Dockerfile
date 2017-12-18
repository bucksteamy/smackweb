FROM golang:1.7.5 as builder
WORKDIR /go/src/github.com/bucksteamy/smackweb/
COPY . .
RUN go get github.com/gorilla/mux
RUN GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o smackweb .

FROM alpine
WORKDIR /app
COPY --from=builder /go/src/github.com/bucksteamy/smackweb/ .

ARG VCS_REF
ARG BUILD_DATE
ARG VERSION

# Metadata
LABEL org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.name="Microsmack Web app" \
      org.label-schema.description="Simple golang web app for use in Kubernetes demos" \
      org.label-schema.vcs-url="https://github.com/chzbrgr71/microsmack" \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.version=$VERSION \
      org.label-schema.docker.dockerfile="/smackweb/Dockerfile"

ENV GIT_SHA $VCS_REF
ENV APP_VERSION $VERSION
ENV IMAGE_BUILD_DATE $BUILD_DATE

ENTRYPOINT /app/smackweb
EXPOSE 8080