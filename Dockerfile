FROM golang:1.7.5 
RUN go get github.com/gorilla/mux
RUN mkdir /app
ADD . /app/
WORKDIR /app

ARG VCS_REF
ARG BUILD_DATE
ARG IMAGE_TAG_REF

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

RUN go build -o smackapi .
ENTRYPOINT /app/smackapi
EXPOSE 8081


